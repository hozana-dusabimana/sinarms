#Requires -Version 5.1
<#
  SINARMS - one-command native runner (no Docker required).

  Starts the whole stack on Windows and installs anything that is missing:
    * Node.js and Python (via winget, if absent)
    * MySQL (starts the bundled XAMPP MySQL if it is not already running)
    * backend npm dependencies
    * AI Python virtualenv + requirements
    * frontend npm dependencies

  Then launches the three services, each in its own window:
    backend   http://localhost:4000   (Express API + Socket.io)
    ai        http://localhost:8001    (FastAPI engine, /healthz)
    frontend  http://localhost:5173    (Vite dev server - open this)

  USAGE (from a PowerShell prompt in the project root):
    powershell -ExecutionPolicy Bypass -File .\run.ps1

  Or just double-click run.bat.

  Flags:
    -Reinstall   delete and reinstall node_modules / venv before starting
    -NoInstall   skip dependency installation, just start the services
#>
[CmdletBinding()]
param(
  [switch]$Reinstall,
  [switch]$NoInstall
)

$ErrorActionPreference = 'Stop'
$root        = $PSScriptRoot
$backendDir  = Join-Path $root 'backend'
$aiDir       = Join-Path $root 'ai'
$frontendDir = Join-Path $root 'frontend'

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    [ok] $msg" -ForegroundColor Green }
function Write-Note($msg) { Write-Host "    [!] $msg"  -ForegroundColor Yellow }
function Write-Bad($msg)  { Write-Host "    [x] $msg"  -ForegroundColor Red }

# True if a TCP port is accepting connections (used to detect running services).
function Test-Tcp([string]$server, [int]$port, [int]$timeoutMs = 1000) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect($server, $port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne($timeoutMs, $false)
    if ($ok -and $client.Connected) { $client.EndConnect($iar); $client.Close(); return $true }
    $client.Close(); return $false
  } catch { return $false }
}

# Reload PATH from the registry so freshly winget-installed tools become visible
# in this already-running session.
function Update-SessionPath {
  $machine = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user    = [System.Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$user"
}

# Ensure a command exists; try winget if not. Returns $true when usable.
function Confirm-Tool([string]$cmd, [string]$wingetId, [string]$name) {
  if (Get-Command $cmd -ErrorAction SilentlyContinue) { Write-Ok "$name found"; return $true }
  Write-Note "$name not found - attempting install via winget ($wingetId)"
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Bad "winget is unavailable. Please install $name manually, then re-run."
    return $false
  }
  try {
    winget install -e --id $wingetId --silent --accept-package-agreements --accept-source-agreements
  } catch {
    Write-Bad "winget install of $name failed: $($_.Exception.Message)"
    return $false
  }
  Update-SessionPath
  if (Get-Command $cmd -ErrorAction SilentlyContinue) { Write-Ok "$name installed"; return $true }
  Write-Bad "$name was installed but is not on PATH yet. Open a NEW terminal and re-run run.ps1."
  return $false
}

# Open a long-running service in its own PowerShell window.
function Start-Service-Window([string]$title, [string]$workDir, [string]$command) {
  $inner = "`$Host.UI.RawUI.WindowTitle='$title'; Set-Location '$workDir'; Write-Host '$title' -ForegroundColor Cyan; $command"
  Start-Process powershell -ArgumentList '-NoExit', '-NoProfile', '-Command', $inner | Out-Null
}

Write-Host "SINARMS native runner" -ForegroundColor Magenta
Write-Host "Project root: $root"

# ---------------------------------------------------------------------------
# 1. Prerequisites
# ---------------------------------------------------------------------------
Write-Step "Checking prerequisites"
$haveNode   = Confirm-Tool 'node'   'OpenJS.NodeJS.LTS'   'Node.js'
$havePython = Confirm-Tool 'python' 'Python.Python.3.11'  'Python'
if (-not $haveNode -or -not $havePython) {
  Write-Bad "Required tools are missing. Aborting."
  exit 1
}

# ---------------------------------------------------------------------------
# 2. MySQL (start bundled XAMPP MySQL if nothing is listening on 3306)
# ---------------------------------------------------------------------------
Write-Step "Checking MySQL on 127.0.0.1:3306"
if (Test-Tcp '127.0.0.1' 3306) {
  Write-Ok "MySQL is already running"
} else {
  Write-Note "MySQL not reachable - trying to start the bundled XAMPP MySQL"
  $xamppRoot = $null
  $idx = $root.ToLower().IndexOf('\htdocs\')
  if ($idx -gt 0) { $xamppRoot = $root.Substring(0, $idx) }

  $mysqld = $null
  if ($xamppRoot) { $mysqld = Join-Path $xamppRoot 'mysql\bin\mysqld.exe' }

  if ($mysqld -and (Test-Path $mysqld)) {
    $ini = Join-Path $xamppRoot 'mysql\bin\my.ini'
    if (Test-Path $ini) {
      Start-Process -FilePath $mysqld -ArgumentList "--defaults-file=`"$ini`"" -WindowStyle Hidden | Out-Null
    } else {
      Start-Process -FilePath $mysqld -WindowStyle Hidden | Out-Null
    }
    $up = $false
    for ($i = 0; $i -lt 30; $i++) {
      if (Test-Tcp '127.0.0.1' 3306) { $up = $true; break }
      Start-Sleep -Seconds 1
    }
    if ($up) { Write-Ok "XAMPP MySQL started" }
    else { Write-Bad "Could not start MySQL. Start it from the XAMPP control panel and re-run."; exit 1 }
  } else {
    Write-Bad "MySQL is not running and XAMPP's mysqld was not found."
    Write-Bad "Start MySQL (XAMPP control panel, or your own MySQL service) and re-run."
    exit 1
  }
}

# ---------------------------------------------------------------------------
# 3. Backend setup
# ---------------------------------------------------------------------------
Write-Step "Backend (Node/Express)"
$backendEnv     = Join-Path $backendDir '.env'
$backendExample = Join-Path $backendDir '.env.example'
if (-not (Test-Path $backendEnv) -and (Test-Path $backendExample)) {
  Copy-Item $backendExample $backendEnv
  Write-Ok "created backend\.env from .env.example"
}
$backendModules = Join-Path $backendDir 'node_modules'
if ($Reinstall -and (Test-Path $backendModules)) { Remove-Item -Recurse -Force $backendModules }
if (-not $NoInstall -and -not (Test-Path $backendModules)) {
  Write-Host "    installing backend dependencies (npm install)..."
  Push-Location $backendDir
  npm install
  Pop-Location
  Write-Ok "backend dependencies installed"
} else {
  Write-Ok "backend dependencies present"
}

# ---------------------------------------------------------------------------
# 4. AI engine setup (virtualenv + requirements)
# ---------------------------------------------------------------------------
Write-Step "AI engine (FastAPI/Python)"
$venvDir = Join-Path $aiDir 'venv'
$venvPy  = Join-Path $venvDir 'Scripts\python.exe'
if ($Reinstall -and (Test-Path $venvDir)) { Remove-Item -Recurse -Force $venvDir }
if (-not (Test-Path $venvPy)) {
  if ($NoInstall) {
    Write-Bad "No venv found and -NoInstall was set. Run without -NoInstall first."
    exit 1
  }
  Write-Host "    creating virtualenv + installing requirements (a few minutes)..."
  Push-Location $aiDir
  python -m venv venv
  & $venvPy -m pip install --upgrade pip
  & $venvPy -m pip install -r requirements.txt
  Pop-Location
  Write-Ok "AI requirements installed"
} else {
  Write-Ok "AI virtualenv present"
}

# ---------------------------------------------------------------------------
# 5. Frontend setup
# ---------------------------------------------------------------------------
Write-Step "Frontend (React/Vite)"
$frontendModules = Join-Path $frontendDir 'node_modules'
if ($Reinstall -and (Test-Path $frontendModules)) { Remove-Item -Recurse -Force $frontendModules }
if (-not $NoInstall -and -not (Test-Path $frontendModules)) {
  Write-Host "    installing frontend dependencies (npm install --legacy-peer-deps)..."
  Push-Location $frontendDir
  # --legacy-peer-deps: @tailwindcss/vite still declares a vite <=7 peer while
  # this project runs vite 8.
  npm install --legacy-peer-deps
  Pop-Location
  Write-Ok "frontend dependencies installed"
} else {
  Write-Ok "frontend dependencies present"
}

# ---------------------------------------------------------------------------
# 6. Launch services
# ---------------------------------------------------------------------------
Write-Step "Starting services (each opens in its own window)"

Start-Service-Window 'SINARMS backend :4000' $backendDir 'npm run dev'

Write-Host "    waiting for backend health on http://localhost:4000/health ..."
$backendOk = $false
for ($i = 0; $i -lt 40; $i++) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:4000/health' -TimeoutSec 2
    if ($resp.StatusCode -eq 200) { $backendOk = $true; break }
  } catch { }
  Start-Sleep -Seconds 1
}
if ($backendOk) { Write-Ok "backend is healthy" }
else { Write-Note "backend not confirmed healthy yet - the AI engine will resync once it is up" }

Start-Service-Window 'SINARMS AI :8001' $aiDir "& '$venvPy' -m uvicorn app.main:app --reload --port 8001"
Start-Service-Window 'SINARMS frontend :5173' $frontendDir 'npm run dev'

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
Write-Step "All services launching"
Write-Host "  frontend : http://localhost:5173   <- open this" -ForegroundColor Green
Write-Host "  backend  : http://localhost:4000"                 -ForegroundColor Green
Write-Host "  ai       : http://localhost:8001/healthz"         -ForegroundColor Green
Write-Host ""
Write-Host "  Demo logins:" -ForegroundColor Magenta
Write-Host "    admin@sinarms.rw / Admin123!              (system admin)"
Write-Host "    reception@ruliba.rw / Reception123!       (Ruliba Clays)"
Write-Host "    reception@tumbacollege.ac.rw / Reception123! (RP Tumba College)"
Write-Host ""
Write-Host "  Stop everything by closing the three service windows (or Ctrl+C in each)."
