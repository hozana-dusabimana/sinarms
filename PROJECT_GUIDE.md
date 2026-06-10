# SINARMS — Project Guide

> **S**mart **I**nstitutional **NA**vigation and **R**esource **M**apping **S**ystem
> A complete reference for presenting, defending, and understanding this capstone project.

---

## 1. The 30-Second Pitch

SINARMS is a **multi-tenant visitor management and campus navigation platform** built for Ruliba Clays Ltd (and seeded with RP Tumba College as a second tenant). A visitor checks in from their phone — no login, no app install — states a destination in plain **English, French, or Kinyarwanda**, and gets **live GPS turn-by-turn navigation** across the campus. Staff see visitors in real time, receive automated security alerts, and manage everything from a web dashboard.

**It is live in production** at <https://sinarms.isiri.rw> with CI/CD auto-deploy from `main`.

### The problem it solves

Visitors at institutions waste time finding offices, and reception cannot track who is on site. SINARMS replaces paper logbooks with:

- Digital self check-in (QR code or web) — no account needed
- AI-assisted destination finding in three languages
- Live GPS navigation with turn-by-turn instructions
- Automated security alerts (GPS lost, restricted zone, idle, long stay, no-show)
- Visitor analytics and feedback collection
- Multi-tenancy: one deployment serves many organizations, fully isolated

---

## 2. Architecture

Three services plus a database, orchestrated with Docker Compose. One `docker compose up --build` runs the whole stack; the backend auto-migrates and seeds on first boot.

| Tier | Stack | Role |
|---|---|---|
| **Frontend** | React 19 + Vite + Leaflet + Tailwind | Visitor portal & staff/admin dashboard (SPA) |
| **Backend** | Node.js + Express 5 + Socket.IO + MySQL | API, auth, routing fallback, business rules |
| **AI engine** | Python FastAPI + DistilBERT + MiniLM | Intent classification, FAQ matching, Dijkstra routing |

```
Visitor / Staff browser
        │
        ▼
React SPA (Leaflet maps, GPS hooks, i18n)
        │  REST + Socket.IO
        ▼
Node.js / Express backend ──── MySQL (13 tables)
        │  HTTP (1.5–4s timeout, 30s circuit breaker)
        ▼
Python FastAPI AI engine (DistilBERT + MiniLM)
        └─ falls back to backend's local matcher + Dijkstra if down
```

---

## 3. Backend (Node.js + Express 5)

### Tech stack

- Express 5, Socket.IO 4.8 (real-time), MySQL2, JWT (`jsonwebtoken`), bcryptjs, qrcode
- Jest + supertest: **31 tests across 16 test files**, all green in CI

### Database schema (13 tables)

| Table | Purpose |
|---|---|
| `organizations` | Tenants; includes the per-org `distanceCheckEnabled` geofence toggle |
| `locations` | Sites under an org; holds `qrCodeToken` for QR check-in |
| `users` | Staff (admin / receptionist) with JSON permission flags |
| `visitors` | Check-ins with destination, computed route, status, survey |
| `visitorPositions` | Immutable movement log (GPS/QR/manual/Wi-Fi sources) |
| `map_nodes` / `map_edges` | The navigation graph per location (geo-referenced) |
| `alerts` | Security alerts with rule-key dedup and auto-resolve |
| `chatbot_faq` | Org-scoped multilingual FAQ entries with hit counts |
| `auditLog` | Immutable trail: actor, action, target, IP, timestamp |
| `analytics_daily` | Dashboard aggregates |
| `feedback` | Standalone visitor feedback (separate from checkout survey) |
| `notifications` | Check-in / department notification events |

### API surface (~40 endpoints)

- `/api/auth` — login/logout (JWT in HTTP-only cookie, 8h expiry)
- `/api/visitors` — self check-in, QR check-in, manual register, checkout, position updates, reroute, delete
- `/api/alerts` — list / acknowledge / resolve
- `/api/analytics` — daily counts, average duration, top destinations, peak hours
- `/api/users`, `/api/organizations` (+ locations & QR generation), `/api/audit-log`
- `/api/map` — get/update the navigation graph (updates sync to the AI engine)
- `/api/faq`, `/api/feedback`, `/api/chatbot/query` — public, no auth
- `/api/bootstrap/public` & `/api/bootstrap/staff` — one-shot app state
- `/ai/*` — bridge to the Python engine with local fallback
- `/api/internal/*` — localhost-only AI resync/state

### Key business rules

- **Check-in flow**: validate location → geofence check (≤100m of entrance, Haversine, skipped for staff manual check-ins or if disabled) → classify destination (AI + fallback) → compute route (AI or local Dijkstra) → create visitor → broadcast `visitor:checkin`.
- **Alert engine** (runs every 60s, rule-keyed and deduped, auto-resolves):
  - `RESTRICTED_ZONE` (high), `GPS_LOST` after 20 min of no position (medium), `IDLE_TIMEOUT` 25 min (medium), `LONG_STAY` 180 min (low), `NO_SHOW` at entrance 10 min (low).
- **Tenant scoping**: receptionists are filtered to their own org + location in the domain layer on every query; admins see all. `visitor.organizationId` is always derived server-side from the location — never client-controlled.
- **Real-time**: Socket.IO broadcasts `visitor:checkin/position/arrived/checkout/deleted`, `alerts:refreshed`, `alert:acknowledged`, `notification:dept`, `feedback:new`.

---

## 4. AI Engine (Python + FastAPI)

### Two genuine ML models

1. **Intent classifier** — fine-tuned `distilbert-base-multilingual-cased` over the destination nodes, blended (weight 0.3) with zero-shot **MiniLM** (`paraphrase-multilingual-MiniLM-L12-v2`) cosine similarity over node labels and aliases.
2. **FAQ matcher** — MiniLM sentence embeddings, cosine similarity, threshold 0.55, organization-scoped.

### Decision thresholds

- **resolve** ≥ 0.68 → navigate immediately
- **confirm** ≥ 0.40 → "Did you mean…?" with alternatives
- below → ask the visitor to rephrase

### Training pipeline (built for this project)

- Generates **~6,000 multilingual training phrases** from the live map graph using 35 templates (14 EN / 11 FR / 10 RW: "ndashaka…", "icyumba…", "ibiro…")
- Augmentation: synonyms, word reordering, filler words
- Optional enrichment from Kaggle Quora question pairs and Tatoeba EN–RW data
- 3 epochs, batch 16, lr 5e-5, 90/10 split, target accuracy ≥ 0.88

### Resilience (a deliberate design point)

- 7-layer fallback cascade ends in a deterministic token-overlap matcher, so the engine still answers with no model and no network.
- The Node backend wraps every AI call in a **1.5s timeout (4s in production) and a 30s circuit breaker**; on failure it uses its own alias matcher and **local Dijkstra**, returning the identical response shape. Visitors never see an AI error.
- The engine **self-heals on startup**: a warm-up thread retries the backend state fetch for ~2 minutes and pre-warms the MiniLM encoder (fixes cold-start timeouts seen in production).

---

## 5. Navigation System

- The campus is a **graph** (`map_nodes` / `map_edges`) with schematic x,y coordinates **geo-referenced to real lat/lng** via an origin point, site footprint (width/height in meters), and rotation.
- Routes come from **Dijkstra**, with turn-by-turn instructions derived from compass bearings between nodes ("Head north from Main Entrance…", "At Reception, turn right toward…"). Time estimate: ~1 min per 45m.
- **GPS hardening on the phone** (custom React hook):
  - Outlier rejection — fixes implying > 35 m/s movement are dropped
  - Accuracy-weighted smoothing and 2-fix movement confirmation
  - Snap-to-route within 18m
  - Routes start at the node **nearest the actual GPS fix**, not blindly at the entrance
- **Off-site approach**: fetches a real-road route from OSRM until the visitor is within 350m of the entrance, then switches to the campus graph.
- **Arrival**: chime + speech announcement; progress pinned at 100%, no false re-arrivals from GPS drift.
- **Geofencing**: check-in requires ≤ 100m from the entrance; auto-checkout after 30 continuous seconds beyond 120m — the 100/120m hysteresis gap prevents flapping. Per-org toggle.

---

## 6. Frontend (React 19 + Vite)

- **16 routes**: 4 visitor-facing (check-in, navigation, feedback, FAQ), 6 staff, 6 admin
- Leaflet maps with floorplan overlays, live visitor markers, and route polylines
- Visitor flow requires **no account**: QR scan or URL → identify → state destination → navigate
- Staff dashboard: live map, active visitors, alerts with acknowledge/resolve, history, feedback inbox, FAQ manager
- Admin: organizations, locations + QR code printing, users + permissions, **visual map editor** (changes sync to the AI engine), audit log, analytics
- **Fully trilingual UI** — English, French, Kinyarwanda (~5,800 translation keys)
- Chatbot assistant widget backed by `/api/chatbot/query`

---

## 7. Testing & Quality

| Suite | Tool | What it proves |
|---|---|---|
| Backend (31 tests, 16 files) | Jest + supertest | Auth, RBAC/permissions, tenant isolation, geofence, alert rules, reroute, socket events, audit log |
| AI engine | pytest | Multilingual classification, Dijkstra, FAQ matching — deterministic, no network needed |
| Frontend simulations | Vitest | Replays a **virtual visitor walking the real seeded RP Tumba campus** with synthetic GPS fixes at 1.6 m/s; asserts correct instructions, monotonic distance countdown, no false arrivals, no false auto-checkout |

All suites run in GitHub Actions CI on every push.

---

## 8. Security

- **JWT** (8h expiry) delivered in HTTP-only cookies; bcrypt password hashing
- **RBAC**: admin / receptionist roles plus a granular JSON permission model (`viewLiveMap`, `manualRegister`, `viewAlerts`, `manageFaq`, `manageUsers`, `editMap`, `viewAuditLog`, …)
- **Strict tenant scoping** enforced server-side — a receptionist can never see another org's data (covered by dedicated tests)
- **Immutable audit log** of every mutation: actor, action, target, IP, timestamp
- QR check-in validates a per-location secret token
- Internal AI-sync endpoints are localhost-only

---

## 9. Production Deployment

Live since **2026-05-31** on an AWS EC2 ARM64 host behind Cloudflare TLS and a CloudPanel reverse proxy:

| URL | Service |
|---|---|
| <https://sinarms.isiri.rw> | Frontend (nginx static) |
| <https://api-sinarms.isiri.rw> | Backend API (`/health` → 200) |
| <https://ai-sinarms.isiri.rw> | AI engine (`/healthz` → 200) |

- **CI/CD**: path-scoped GitHub Actions workflows auto-build and deploy on push to `main` (`deploy-backend.yml`, `deploy-frontend.yml`, `deploy-ai.yml`) — verified end-to-end
- Docker Compose production stack; backend + AI on host networking to reach MySQL; WebSocket upgrade verified (Socket.IO 101)
- **Real production problems solved**: port conflicts with a co-hosted app, ARM cold-start encoder timeouts, online disk expansion (9GB → 60GB without reboot), Vite build OOM on a 1.8GB-RAM box

---

## 10. Hardest Problems Solved (honest answers)

1. **GPS noise** — coarse Wi-Fi fixes caused phantom route progress and false instant arrivals. Solved with accuracy-weighted blending, movement-confirmation streaks, drift-aware arrival detection, and starting routes at the node nearest the actual fix. Every fix is locked in by simulation tests.
2. **Cold-start AI in production** — the first chatbot queries on the ARM server exceeded the backend's AI timeout and tripped the circuit breaker into offline mode. Fixed with a startup warm-up thread that preloads the encoder and retries the backend fetch.
3. **Tenant isolation** — guaranteeing a receptionist can never leak another organization's visitors; enforced once in the domain layer rather than per-route, and covered by dedicated tests.

## 11. Future Work

- Push live updates to the staff dashboard over Socket.IO (server already emits all events; the frontend currently polls every 10s)
- Real speech-to-text for the assistant (currently a stub)
- Use the visitor's `language` hint inside AI queries
- Indoor positioning (Wi-Fi / BLE) where GPS fails
- Pre-computed analytics aggregation into `analytics_daily`

---

## 12. Key Numbers

- **106+ commits**, 3 services, 13 DB tables, ~40 API endpoints, 16 frontend routes
- ML: fine-tuned multilingual DistilBERT + MiniLM-L12-v2; ~6,000 generated training phrases; FAQ threshold 0.55, resolve threshold 0.68
- ~5,800 UI translation keys across EN / FR / RW
- Seeded demo data: 2 organizations, 4 locations, 4 maps, 8 FAQs

## 13. Demo Cheat-Sheet

1. **Visitor flow**: open the site → check in (or scan a location QR) → type "where is procurement" → watch live navigation
2. **Chatbot**: ask in Kinyarwanda ("ndashaka ibiro bya HR") to show multilingual AI
3. **Staff**: log in as a receptionist → live map, alerts, manual check-in, feedback inbox
4. **Admin**: organizations, map editor (edits re-train the AI's graph), audit log, analytics
5. **Resilience demo**: stop the AI container — navigation still works via the local fallback

> Demo credentials are listed in `RUNGUIDE.md`. Change the seeded admin password before any public demo.
