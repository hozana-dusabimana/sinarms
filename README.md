# SINARMS

Smart Institutional Navigation and Resource Mapping System for Ruliba Clays Ltd.

See [RUNGUIDE.md](RUNGUIDE.md) for the full install and run walkthrough.

## Monorepo layout

| Folder       | Role                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------- |
| `frontend/`  | React 18 + Vite visitor & staff apps.                                                    |
| `backend/`   | Node.js + Express + Socket.IO API, MySQL via `mysql2`.                                   |
| `ai/`        | Python FastAPI AI engine — DistilBERT intent classifier + MiniLM FAQ matcher.            |

## AI engine — quick start

```bash
# 1. Start the Node.js API (serves the map graph + FAQ for training/inference)
cd backend && npm install && npm run dev

# 2. In another terminal, boot the Python AI engine
cd ai
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Port 8001 is used because Windows often reserves 8000. If you change the port,
update `AI_ENGINE_URL` in `backend/.env` to match.

With no fine-tuned weights present the engine serves zero-shot multilingual
embedding similarity over the facility aliases. To train the production
DistilBERT classifier:

```bash
cd ai
python -m training.generate_dataset --base-url http://localhost:4000
python -m training.download_kaggle   # optional, requires ~/.kaggle/kaggle.json
python -m training.train_intent --epochs 3
```

The Node.js backend calls the AI engine at `AI_ENGINE_URL` (default
`http://127.0.0.1:8001`) and falls back to the deterministic matcher when the
service is unreachable. Set `AI_ENGINE_DISABLED=1` to force the fallback path
(used by the Jest test suite).

## Demo staff credentials

Seeded by `backend/src/data/seed.js` (run `npm run migrate` to apply).

| Role         | Email                  | Password        |
| ------------ | ---------------------- | --------------- |
| Admin        | `admin@ruliba.rw`      | `Admin123!`     |
| Receptionist | `reception@ruliba.rw`  | `Reception123!` |

Visitors check in from the landing page — no login required.

## Tests

```bash
cd backend && npm test                  # requires MySQL — see backend/README.md
cd ai && python -m pytest tests/        # AI engine integration tests
cd frontend && npm test                 # Vitest
```
