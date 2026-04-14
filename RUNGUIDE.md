# SINARMS — Run Guide

A step-by-step guide to install and start every part of the project on a fresh machine.

## 1. Prerequisites

Install these first (any recent version is fine):

- **Node.js 20+** — for backend and frontend
- **Python 3.10+** — for the AI engine
- **MySQL 8** (or MariaDB 10+) — XAMPP ships both. Start MySQL from the XAMPP control panel.
- **Git** — to clone and update the project

Check the versions:

```bash
node -v
python --version
mysql --version
```

## 2. Clone the project

```bash
git clone <repo-url> sinarms
cd sinarms
```

The repo has three apps: `backend/` (Node/Express), `frontend/` (React/Vite), `ai/` (FastAPI/Python).

## 3. Create the database

Open phpMyAdmin (or MySQL CLI) and create an empty database:

```sql
CREATE DATABASE sinarms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Default XAMPP credentials (`root` / empty password) are already the defaults in `.env.example`.

## 4. Backend

```bash
cd backend
cp .env.example .env
# On Windows PowerShell use: copy .env.example .env
npm install
npm run migrate   # creates tables and seeds demo data
npm run dev       # starts the API on http://localhost:4000
```

If MySQL is running on a different host/port/user, edit `.env` before running `migrate`.

Leave the backend terminal running.

## 5. AI engine (FastAPI)

Open a **second terminal**.

```bash
cd ai
python -m venv venv
venv\Scripts\activate           # Windows
# source venv/bin/activate      # macOS / Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Why port 8001: Windows often reserves 8000. If you use a different port, update
`AI_ENGINE_URL` in `backend/.env` to match.

Quick health check:

```bash
curl http://127.0.0.1:8001/health
```

Leave this terminal running too.

## 6. Frontend (Vite)

Open a **third terminal**.

```bash
cd frontend
npm install
npm run dev       # starts the UI on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

## 7. Demo logins

Seeded accounts (set in `backend/src/data/seed.js`):

| Role         | Email                  | Password        |
|--------------|------------------------|-----------------|
| Admin        | `admin@ruliba.rw`      | `Admin123!`     |
| Receptionist | `reception@ruliba.rw`  | `Reception123!` |

Visitors check in from the landing page — no login required.

## 8. Optional: OpenRouter polish layer

The chatbot can optionally route answers through OpenRouter for a more natural
tone. Without a key the local models still work — you just skip the rewrite.

1. Get a free key at https://openrouter.ai/keys
2. Paste it into `backend/.env` as `OPENROUTER_API_KEY=...`
3. Restart the backend.

## 9. Running the tests

```bash
# Backend (Jest) — requires the DB reachable
cd backend && npm test

# AI engine (pytest)
cd ai && venv\Scripts\activate && pytest

# Frontend (Vitest)
cd frontend && npm test
```

## Common issues

- **`uvicorn` — "socket access forbidden"** — port 8000 is reserved on Windows. Use `--port 8001` (already the default in `.env.example`).
- **Backend crashes on startup** — check that MySQL is running and `backend/.env` credentials are correct. Run `npm run migrate` again if tables are missing.
- **Frontend shows "AI assistant unavailable"** — the FastAPI process isn't running, or `AI_ENGINE_URL` in `backend/.env` points to the wrong port.
- **Map has no destination pin** — hard-refresh (`Ctrl+Shift+R`) to drop the cached bundle.

## One-terminal shortcut (optional)

If you'd rather not juggle three terminals, in three separate shells run:

```bash
# Terminal 1
cd backend && npm run dev
# Terminal 2
cd ai && venv\Scripts\activate && uvicorn app.main:app --reload --port 8001
# Terminal 3
cd frontend && npm run dev
```
