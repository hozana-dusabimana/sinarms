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

## 10. Local chatbot — research/demo artifact

A self-hosted retrieval chatbot trained on a Kaggle-style CSV dataset plus the
live conversation log. **Not** wired into the production chatbot route — the
production path still uses the deterministic intent classifier + FAQ matcher
with optional OpenRouter polish. This artifact exists so a future iteration of
the project could replace OpenRouter without an external API.

### Datasets

- `ai/data/external/chatbot_bootstrap.csv` — small visitor-domain Q&A grouped
  by topic (greeting, toilet, reception, manager, parking, hours, …) in
  English, Kinyarwanda, and French. Tracked in git.
- `ai/data/conversation_log.csv` — appended automatically on every chatbot
  query by the backend (`backend/src/services/conversationLog.js`). Gitignored.
- `ai/data/external/<your-kaggle-set>.csv` — optional. Pull a real Kaggle Q&A
  set with:

  ```bash
  cd ai
  python -m training.download_kaggle --qa-kaggle kreeshrajani/3k-conversations-dataset-for-chatbot
  ```

  Requires `~/.kaggle/kaggle.json`. Without credentials the bootstrap CSV is
  enough to demo the pipeline.

### Train

```bash
cd ai
venv\Scripts\activate
python -m training.train_local_chatbot
```

The trainer reads every CSV under `ai/data/external/` plus the resolved rows of
the live log, encodes the questions with the multilingual MiniLM model already
in use by the FAQ matcher, holds out 20% as a stratified test set, and prints
top-1 / top-3 retrieval accuracy and mean answer similarity. Artifacts land at
`ai/artifacts/local_chatbot/{embeddings.npy, corpus.jsonl, meta.json}`.

### Demo

```bash
python -m training.chat_repl
```

Shows the matched question, similarity score, and the next two alternatives so
it is clear *why* the bot answered the way it did. Type `:meta` to print the
training run metadata (model id, train size, accuracy), `:q` to quit.

## 11. Run everything in Docker

If you have Docker Desktop, you can skip the manual setup above and run the
whole stack — MySQL, backend, AI engine, and frontend — with one command. No
local Node, Python, or MySQL install is needed.

```bash
docker compose up --build
```

Then open <http://localhost:5173>.

What you get:

| Service    | Host URL                  | Notes                                            |
|------------|---------------------------|--------------------------------------------------|
| frontend   | http://localhost:5173     | Vite dev server with hot reload — open this      |
| backend    | http://localhost:4000     | Express API; auto-migrates and seeds on boot     |
| ai         | http://localhost:8001     | FastAPI engine (`/healthz`)                      |
| db         | localhost:3307            | MySQL 8 (3307 so it won't clash with XAMPP)      |

Notes:

- **Hot reload** — `backend/`, `frontend/`, and `ai/` source folders are
  bind-mounted, so edits on the host reload live inside the containers.
- **First build is slow** — the AI image bakes the multilingual MiniLM model in
  so the engine works fully offline afterwards (no runtime download). Expect a
  few minutes and a multi-GB image the first time.
- **Demo logins** are the same as section 7. Seed data is created automatically;
  you do not need to run `npm run migrate`.
- **OpenRouter polish** — set `OPENROUTER_API_KEY` under the `backend` service in
  `docker-compose.yml` (or export it before `up`) to enable it.
- **Reset the database** — `docker compose down -v` removes the `db_data`
  volume so the next `up` reseeds from scratch.
- **Rebuild after dependency changes** — if you change `package.json` or
  `requirements.txt`, run `docker compose up --build` and, if needed,
  `docker compose down -v` to drop the cached `node_modules` volumes.

Common issues:

- **Port already in use** — stop any local backend/frontend/MySQL, or change the
  left-hand side of the `ports:` mappings in `docker-compose.yml`.
- **Frontend can't reach the API** — confirm the `backend` container is healthy
  (`docker compose ps`); the Vite proxy targets `http://backend:4000` inside the
  Docker network.

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
