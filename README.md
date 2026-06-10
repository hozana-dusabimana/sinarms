# SINARMS

**Smart Institutional Navigation and Resource Mapping System**

A multi-tenant visitor management and campus navigation platform. Visitors check in from their phone — no login, no app install — state their destination in **English, French, or Kinyarwanda**, and get live GPS turn-by-turn navigation across the campus. Staff track visitors in real time, receive automated security alerts, and manage everything from a web dashboard.

Built as a capstone project for **Ruliba Clays Ltd**, and deployed multi-tenant with **RP Tumba College** and **Qonics** as additional seeded institutions.

🌍 **Live demo:** <https://sinarms.isiri.rw>

See [RUNGUIDE.md](RUNGUIDE.md) for the full install and run walkthrough.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Monorepo layout](#monorepo-layout)
- [Quick start (Docker)](#quick-start-docker)
- [Manual setup](#manual-setup)
- [The AI engine](#the-ai-engine)
- [Navigation & GPS pipeline](#navigation--gps-pipeline)
- [Security model](#security-model)
- [Demo credentials](#demo-credentials)
- [Tests](#tests)
- [Deployment & CI/CD](#deployment--cicd)

---

## Features

### Visitor portal (no login required)
- **Self check-in** in 3 steps: pick a location → identify yourself → state your destination in plain language.
- **QR check-in** — scan a location QR code to pre-fill the location (and optionally the destination).
- **Live GPS navigation** on a Leaflet/OpenStreetMap map: route polyline, turn-by-turn instructions, distance countdown, arrival chime + spoken announcement.
- **Off-site approach routing** — while still far from campus, the app fetches a real-road route from OSRM and switches to the internal campus route on arrival at the entrance.
- **AI assistant chat** — ask "Where is the HR office?" or "Ese parking irahari?" and get an answer or an instant reroute.
- **Geofenced auto-checkout** — drifting off campus ends the visit automatically (per-organization toggle).
- **Checkout survey & standalone feedback** forms.
- **Public FAQ page**, filterable by institution.

### Staff & admin portal
- **Live dashboard** — active visitor directory, real-time positions on the map, security alerts.
- **Automated security alerts**: GPS lost, restricted zone entry, idle timeout, long stay, no-show — auto-raised and auto-resolved by rule engine sweeps.
- **Manual visitor registration & checkout** for walk-ins.
- **Visitor history** with filters and CSV export.
- **Facility map editor** (admin) — drag-and-drop nodes and edges, GPS trails, floorplan image overlay, per-location QR code generation.
- **Organization / location / user management** (admin) with granular per-user permissions.
- **FAQ management** — receptionists curate FAQs scoped to their institution; entries feed the AI matcher.
- **Analytics dashboard** — daily counts, average visit duration, top destinations, peak hours.
- **Full audit log** of every mutation (actor, action, target, IP, timestamp).
- **Feedback inbox** for visitor feedback.

### Cross-cutting
- **Multi-tenant** — organizations → locations → scoped staff; receptionists only ever see their own institution's data (enforced server-side).
- **Trilingual UI** — English, French, Kinyarwanda (~5,800 translation keys).
- **Graceful degradation** — every AI feature has a deterministic local fallback; the system stays fully functional with the AI engine offline.

---

## Architecture

```
┌──────────────────┐     /api, /ai      ┌─────────────────────┐   classify-intent   ┌──────────────────────┐
│   Frontend       │ ─────────────────▶ │   Backend           │ ──────────────────▶ │   AI Engine          │
│   React 19+Vite  │                    │   Node + Express 5  │   calculate-route   │   Python FastAPI     │
│   Leaflet maps   │ ◀───socket.io───── │   Socket.IO         │   chatbot           │   DistilBERT+MiniLM  │
└──────────────────┘                    │   JWT auth          │ ◀────────────────── │   Dijkstra (NetworkX)│
                                        └────────┬────────────┘   fetch maps/FAQ    └──────────────────────┘
                                                 │ mysql2
                                            ┌────▼────┐
                                            │  MySQL  │  13 tables: orgs, locations, users, visitors,
                                            └─────────┘  positions, map nodes/edges, alerts, FAQ,
                                                          audit log, analytics, feedback, notifications
```

- The **backend** owns all state and business rules. It calls the AI engine with a short timeout and a 30s circuit breaker; on any failure it falls back to its own deterministic alias matcher and local Dijkstra routing with an identical response shape — visitors never see an AI error.
- The **AI engine** is stateless: it pulls the map graph and FAQ from the backend at startup (with retry) and on admin-triggered refreshes, and pre-warms its sentence encoder so the first visitor query is fast.
- **Campus maps are graphs**: nodes (offices, corridors, checkpoints, exits — with multilingual aliases and zone types) and weighted edges, geo-referenced from schematic x/y to real lat/lng via a site origin, footprint, and rotation.

## Monorepo layout

| Folder      | Role                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| `frontend/` | React 19 + Vite SPA — visitor portal, staff dashboard, admin suite. Tailwind CSS, Leaflet, Framer Motion. |
| `backend/`  | Node.js + Express 5 + Socket.IO API. MySQL via `mysql2`, JWT auth, migrations + seed. |
| `ai/`       | Python FastAPI AI engine — DistilBERT intent classifier, MiniLM FAQ matcher, training pipeline. |

## Quick start (Docker)

The whole stack (MySQL, backend, AI engine, frontend) runs with one command:

```bash
docker compose up --build
```

Then open <http://localhost:5173>. The backend creates the schema and seeds demo data automatically on first boot. See the **Docker** section of [RUNGUIDE.md](RUNGUIDE.md#11-run-everything-in-docker) for details.

## Manual setup

```bash
# 1. Start the Node.js API (serves the map graph + FAQ for training/inference)
cd backend && npm install && npm run dev

# 2. In another terminal, boot the Python AI engine
cd ai
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001

# 3. In a third terminal, start the frontend
cd frontend && npm install && npm run dev
```

Port 8001 is used because Windows often reserves 8000. If you change the port, update `AI_ENGINE_URL` in `backend/.env` to match.

## The AI engine

Two multilingual models behind a layered fallback cascade:

| Model | Checkpoint | Job |
| ----- | ---------- | --- |
| Intent classifier | `distilbert-base-multilingual-cased` (fine-tuned) | Map a free-text query to a destination node |
| Semantic matcher  | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Zero-shot alias similarity + FAQ matching |

**Classification cascade** (first confident hit wins): literal/fuzzy alias match (typo-tolerant via Levenshtein) → acronym expansion (`hr`, `md`, `it`…) → MiniLM embedding similarity blended with fine-tuned DistilBERT scores (blend weight 0.3, retrieval-dominant so a stale classifier can't outvote a live map) → token-overlap keyword fallback (works fully offline) → cross-location search. Confidence ≥ 0.68 resolves directly, ≥ 0.40 asks the visitor to confirm from alternatives, below that asks to rephrase.

**FAQ matching**: each entry is embedded once and cached; queries match by cosine similarity (threshold 0.55), scoped to the visitor's organization plus global entries.

With no fine-tuned weights present the engine serves zero-shot embedding similarity over the facility aliases. To train the production DistilBERT classifier:

```bash
cd ai
python -m training.generate_dataset --base-url http://localhost:4000
python -m training.download_kaggle   # optional, requires ~/.kaggle/kaggle.json
python -m training.train_intent --epochs 3
```

The dataset generator expands every destination node through 35 phrase templates (14 EN / 11 FR / 10 RW) with augmentation (synonym swaps, token reordering, filler words), optionally enriched with Kaggle Quora question pairs and Tatoeba English–Kinyarwanda sentences, targeting ~6,000 examples and ≥ 0.88 held-out accuracy.

The backend calls the engine at `AI_ENGINE_URL` (default `http://127.0.0.1:8001`) and falls back to the deterministic matcher when the service is unreachable. Set `AI_ENGINE_DISABLED=1` to force the fallback path (used by the Jest test suite).

## Navigation & GPS pipeline

Consumer phone GPS is noisy; the navigation page is engineered around that:

- **Outlier rejection** — fixes implying impossible speed (> 35 m/s) from coarse sources are dropped.
- **Accuracy-weighted smoothing** — precise fixes move the marker decisively; coarse Wi-Fi fixes barely nudge it.
- **Movement confirmation** — two consecutive beyond-deadband fixes are required before the marker moves, eliminating stationary jitter.
- **Snap-to-route** — the displayed position map-matches onto the route polyline within 18 m.
- **Routes start at the node nearest the actual GPS fix**, not a fixed entrance, and **rerouting** (e.g. via the chatbot) recalculates from the visitor's live position.
- **Geofence hysteresis** — check-in requires being within 100 m of the entrance; auto-checkout only fires after 30 continuous seconds beyond 120 m, using raw (unsmoothed) GPS.

These behaviours are locked in by **simulation tests** that replay a virtual visitor walking the real seeded RP Tumba campus with synthetic GPS fixes (see `frontend/src/test/*.sim.test.jsx`).

## Security model

- **JWT auth** (HTTP-only cookies + Bearer header), bcrypt password hashing, 8h expiry.
- **Roles & permissions** — admin and receptionist roles with a granular JSON permission map (`viewLiveMap`, `manualRegister`, `manageFaq`, `editMap`, …) checked by middleware.
- **Tenant scoping enforced in the domain layer** — every query a receptionist makes is filtered to their organization + location; covered by dedicated tests.
- **Immutable audit log** of all mutations with actor, target, details, and IP.
- **QR check-in tokens** validated per location; AI sync endpoints are localhost-only.

## Demo credentials

Seeded by `backend/src/data/seed.js` (run `npm run migrate` to apply).

| Role                  | Email                            | Password        |
| --------------------- | -------------------------------- | --------------- |
| System Admin          | `admin@sinarms.rw`               | `Admin123!`     |
| Receptionist (Ruliba) | `reception@ruliba.rw`            | `Reception123!` |
| Receptionist (Tumba)  | `reception@tumbacollege.ac.rw`   | `Reception123!` |
| Receptionist (Qonics) | `reception@qonics.com`           | `Reception123!` |

Visitors check in from the landing page — no login required.

## Tests

```bash
cd backend && npm test                  # Jest + supertest (requires MySQL — see backend/README.md)
cd ai && python -m pytest tests/        # AI engine integration tests (offline, deterministic)
cd frontend && npm test                 # Vitest, incl. GPS navigation simulations
```

Coverage highlights: auth & permissions, tenant scoping, geofence rules, alert escalation, rerouting, Socket.IO events (backend); multilingual intent classification, Dijkstra routing, FAQ matching, graph refresh (AI); full campus-walk GPS simulations, geolocation smoothing, check-in flows (frontend).

## Deployment & CI/CD

Production runs the three containers via `docker-compose.prod.yml` behind Cloudflare TLS and a CloudPanel reverse proxy:

| Service  | URL |
| -------- | --- |
| Frontend | <https://sinarms.isiri.rw> |
| API      | <https://api-sinarms.isiri.rw/health> |
| AI       | <https://ai-sinarms.isiri.rw/healthz> |

GitHub Actions runs the test suites on every push (`.github/workflows/ci.yml`) and path-scoped workflows (`deploy-backend.yml`, `deploy-frontend.yml`, `deploy-ai.yml`) auto-deploy each service to the server when its folder changes on `main`.
