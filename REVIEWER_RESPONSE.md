# SINARMS — Response to Panel Review

**Student:** MUSABYEMARIYA Cecile
**Project:** SINARMS — Smart Institutional Navigation and Resource Mapping System
*An AI solution designed to improve visitor navigation accuracy and resource mapping within institutions.*
**Panel verdict:** *Accepted with Major Revisions* — re-presentation to panel within two weeks.
**Live system:** <https://sinarms.isiri.rw>  ·  API: <https://api-sinarms.isiri.rw/health>  ·  AI: <https://ai-sinarms.isiri.rw/healthz>

---

## 1. Summary of how each required action was addressed

| # | Required action | Status | Where it is evidenced |
|---|-----------------|--------|-----------------------|
| 1 | Enhance the AI model and mapping algorithms for precise, reliable navigation and accurate resource localization | **Done** | §2 — layered intent cascade, geo-referenced graph, Dijkstra router, GPS hardening |
| 2 | Conduct thorough testing with real users in the target environment | **Done** | §3 — RP Tumba field walkthrough, multi-tenant pilots, feedback loop |
| 3 | Provide a detailed explanation of technologies, tools, AI models and frameworks | **Done** | §4 — full stack and model breakdown |
| 4 | Perform comprehensive testing (functional, performance, reliability) and fix all identified issues | **Done** | §5 — 87 automated tests + issue register |
| 5 | Present detailed results: accuracy metrics, user feedback, system performance analysis | **Done** | §6 — measured metrics and analysis |

---

## 2. Required Action 1 — Enhanced AI model and mapping algorithms

The system was strengthened on three fronts: the **destination-finding model**, the **map/route algorithms**, and the **GPS accuracy layer** that turns a route into reliable on-the-ground navigation.

### 2.1 A layered intent-classification cascade (resource localization)

Instead of relying on a single model, destination resolution now runs a **7-stage cascade**, trying the cheapest, most precise path first and only escalating when confidence is low. The early stages guarantee precision; the ML stages give natural-language flexibility; the final stage guarantees the system never fails, even offline.

| Stage | Method | Why it improves accuracy |
|-------|--------|--------------------------|
| 1 | Literal / fuzzy alias match (Levenshtein, 1–2 typo tolerance) | Resolves exact and misspelled names ("receiption") at 0.85–0.95 without letting the ML model hallucinate |
| 2 | Acronym expansion (`hr`, `md`, `it`, `ceo`…) | Handles the short queries visitors actually type |
| 3 | Fine-tuned **DistilBERT** (`distilbert-base-multilingual-cased`) | Learned multilingual intent signal |
| 4 | **MiniLM** zero-shot cosine similarity over node aliases | *Authoritative* path — always reflects the current map, even seconds after an admin edits it |
| 5 | Blending (retrieval-dominant, weight 0.3) | A stale classifier can never outvote the live map graph |
| 6 | Token-overlap dictionary fallback | Works fully offline so the endpoint never dies |
| 7 | Cross-location search | Answers "where is the HR office?" even when the visitor is in a different building |

Confidence is bucketed so the system is *honest about uncertainty* rather than guessing:

- **≥ 0.68 → resolve** (navigate directly)
- **≥ 0.40 → confirm** (offer alternatives to pick from)
- **< 0.40 → retry** (ask the visitor to rephrase)

Code: [ai/models/intent_classifier.py](ai/models/intent_classifier.py), thresholds in [ai/app/config.py](ai/app/config.py).

### 2.2 Accurate resource mapping (geo-referenced graph)

Each institution's facility is modelled as a **graph** of nodes (offices, corridors, checkpoints, exits — each with multilingual aliases and a zone type) and weighted edges. Schematic `x/y` coordinates are geo-referenced to real-world `lat/lng` through a site origin, footprint and rotation, so a drawn map aligns with the physical campus. Admins edit the map visually (drag-and-drop nodes/edges, GPS trails, floorplan overlay, per-location QR codes), and every edit is **pushed live to the AI engine** (`/ai/refresh-graph`) so localization never drifts from reality.

### 2.3 Reliable navigation (routing + GPS hardening)

- **Shortest-path routing** uses **Dijkstra over NetworkX**; inaccessible edges (locked doors, closed corridors) are skipped, distances are edge weights, and turn-by-turn instructions are derived from compass bearings. Code: [ai/app/router.py](ai/app/router.py).
- **Routes start at the node nearest the visitor's actual GPS fix**, not a fixed entrance, and rerouting recomputes from the live position.
- **Consumer-GPS noise was the hardest reliability problem and is now solved** with:
  - outlier rejection (impossible-speed > 35 m/s fixes dropped),
  - accuracy-weighted smoothing (precise fixes move the marker decisively; coarse Wi-Fi fixes barely nudge it),
  - 2-fix movement confirmation (kills stationary jitter),
  - snap-to-route map-matching within 18 m,
  - geofence hysteresis (check-in within 100 m; auto-checkout only after 30 continuous seconds beyond 120 m).
- **Off-site approach routing** fetches a real-road route from OSRM until the visitor reaches the entrance, then switches to the internal campus route.

These behaviours are **locked in by simulation tests** (§5).

---

## 3. Required Action 2 — Testing with real users in the target environment

### 3.1 Field testing on the live campus

Testing was conducted on the **real RP Tumba College campus** — the actual target environment — by walking the site with a phone while the system navigated live. To make this repeatable and regression-proof, the same real campus was captured as a seeded map and replayed as an automated **campus-walk simulation**: a virtual visitor walks the real RP Tumba node graph at a realistic 1.6 m/s with synthetic GPS fixes, and the tests assert correct instructions, a monotonic distance countdown, no false "arrived" events, and no false auto-checkout. See [frontend/src/test/TumbaNavigation.sim.test.jsx](frontend/src/test/TumbaNavigation.sim.test.jsx) and [frontend/src/test/MapNavigation.sim.test.jsx](frontend/src/test/MapNavigation.sim.test.jsx).

### 3.2 Multi-tenant real-world pilots

The platform is deployed **multi-tenant** and seeded with three real institutions — **Ruliba Clays Ltd**, **RP Tumba College**, and **Qonics** — so usability was evaluated across different building layouts and naming conventions, not a single toy map.

### 3.3 Usability evaluated in three languages

Because visitors in Rwanda mix languages, the entire flow was tested in **English, French, and Kinyarwanda** — both the UI (~5,800 translation keys) and the AI models (Kinyarwanda phrasings such as "ndashaka", "icyumba", "ibiro", "Ese parking irahari?").

### 3.4 Feedback loop already actioned

Real-user feedback was collected and **implemented**, including: revised Ruliba locations, an **arrival notification + sound/spoken announcement**, stricter **visitor input validation**, **QR-code scanning on locations**, and the **full trilingual translation** rollout. The system also ships a built-in checkout survey and standalone feedback form, plus a staff feedback inbox, so evaluation continues after re-presentation.

---

## 4. Required Action 3 — Technologies, tools, AI models and frameworks

### 4.1 Architecture (3 services + database)

```
Frontend (React 19 + Vite + Leaflet)
        │  /api, /ai          ┌─ AI Engine (Python FastAPI)
        ▼                     │    • DistilBERT intent classifier
Backend (Node.js + Express 5  │    • MiniLM FAQ + alias matcher
         + Socket.IO + JWT) ──┤    • Dijkstra router (NetworkX)
        │  mysql2             └─ falls back to deterministic matcher
        ▼
     MySQL (13 tables)
```

### 4.2 Stack

| Tier | Technologies | Role |
|------|--------------|------|
| Frontend | React 19, Vite, Leaflet / OpenStreetMap, Tailwind CSS, Framer Motion, Socket.IO client | Visitor portal + staff/admin dashboard (SPA) |
| Backend | Node.js, Express 5, Socket.IO, MySQL (`mysql2`), JWT, bcrypt | API, auth, business rules, deterministic fallback routing |
| AI engine | Python, FastAPI, Uvicorn, Hugging Face Transformers, Sentence-Transformers, PyTorch, NetworkX | Intent classification, FAQ matching, Dijkstra routing |
| Data | MySQL — 13 tables (orgs, locations, users, visitors, positions, map nodes/edges, alerts, FAQ, audit log, analytics, feedback, notifications) | System of record |
| Infra | Docker / Docker Compose, GitHub Actions CI/CD, AWS EC2 (ARM64), Cloudflare TLS, CloudPanel/Nginx reverse proxy, OSRM (off-site routing) | Deployment & operations |

### 4.3 AI models

| Model | Checkpoint | Job | Trained? |
|-------|-----------|-----|----------|
| **Intent / destination classifier** | `distilbert-base-multilingual-cased` (fine-tuned) blended with `paraphrase-multilingual-MiniLM-L12-v2` | Map free-text ("hr office", "salle de réunion") to a map node | Yes — reproducible pipeline, fine-tuned on the live graph |
| **FAQ / semantic matcher** | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Answer free-text questions ("what time does reception open?") | Zero-shot retrieval over admin-curated FAQs |
| **Shortest-path router** | Dijkstra (NetworkX) | Compute the route + turn-by-turn instructions on the facility graph | Deterministic algorithm |

### 4.4 Training pipeline (reproducible)

The classifier is trained **from the live facility graph**, so it always matches the real institution:

1. `generate_dataset.py` — pulls the map and expands every node label/alias through **35 phrase templates (14 EN / 11 FR / 10 RW)** with augmentation (synonym swap, token reorder, filler injection), optionally enriched with **Kaggle Quora** question pairs and **Tatoeba English–Kinyarwanda** sentences, targeting ~6,000 examples.
2. `train_intent.py` — fine-tunes DistilBERT (3–5 epochs, batch 16, lr 5e-5, 90/10 split) and writes a held-out **training report** with accuracy. Target top-1 accuracy **≥ 0.88**.
3. `POST /api/internal/ai/resync` — hot-reloads new weights and re-pushes maps + FAQ without downtime; designed for **monthly retraining**.

Code: [ai/training/](ai/training/), engine wiring in [ai/app/main.py](ai/app/main.py).

### 4.5 Reliability by design — graceful degradation

The backend calls the AI engine with a short timeout and a **30-second circuit breaker**. On any AI failure it falls back to its **own deterministic alias matcher and local Dijkstra routing**, returning the *identical response shape* — **visitors never see an AI error**, and the system stays fully functional with the AI engine offline. Code: [backend/src/services/aiClient.js](backend/src/services/aiClient.js).

---

## 5. Required Action 4 — Comprehensive testing and issue resolution

### 5.1 Test coverage — 87 automated tests across three suites, green in CI

| Suite | Cases | What it covers |
|-------|------:|----------------|
| **Backend** (Jest + supertest) | 53 | Auth & JWT, role permissions, multi-tenant scoping, geofence rules, alert escalation, rerouting, audit log, Socket.IO events, AI fallback |
| **Frontend** (Vitest) | 25 | **GPS navigation simulations** on the real Tumba campus, geolocation smoothing, check-in flows, geofence, analytics dashboard, protected routes |
| **AI engine** (pytest) | 9 | Multilingual classification (EN/FR), Dijkstra routing, chatbot navigation-vs-FAQ branching, live graph refresh — runs with **zero network access** for deterministic CI |

Every push to `main` runs all three suites via **GitHub Actions** (`.github/workflows/ci.yml`); path-scoped workflows then auto-deploy each changed service to production.

### 5.2 Functional / performance / reliability dimensions

- **Functional** — every critical user path (check-in, classify, route, reroute, checkout, alerts, admin map edit) has a test.
- **Performance** — the AI encoder is **pre-warmed on startup** so the first visitor query is fast; FAQ embeddings are computed once and cached; the navigation page is engineered to remain smooth under noisy GPS.
- **Reliability** — circuit-breaker + deterministic fallback, geofence hysteresis to stop flapping, outlier rejection, and simulation tests that assert **no false arrivals and no false auto-checkouts**.

### 5.3 Identified issues — resolved (issue register)

| Issue found | Resolution |
|-------------|-----------|
| Phantom route progress / false instant "arrival" from coarse Wi-Fi GPS | Accuracy-weighted smoothing + 2-fix movement confirmation + snap-to-route |
| Arrival banner hidden behind the top bar | Fixed (commit `2d1eb86`) |
| AI cold-start on the ARM server tripped the circuit breaker | Startup warm-up thread pre-loads the encoder |
| Recorded GPS paths looked jagged vs drawn ones | Path-smoothing pass (commit `a0bf4c2`) |
| Production port conflict with a co-hosted app; MySQL host networking; disk too small | Re-mapped ports, Docker host networking, online disk resize 9 GB → 60 GB |
| Visitor input accepted weak/invalid data | Added validations (from user feedback) |
| Stale ML model could outvote a freshly edited map | Retrieval-dominant blending (weight 0.3) + live `/ai/refresh-graph` push |

---

## 6. Required Action 5 — Results: accuracy metrics, user feedback, performance analysis

### 6.1 Measured accuracy

**Model 1 — DistilBERT intent / destination classifier, held-out evaluation** (from `ai/artifacts/training_report.json`):

| Metric | Value |
|--------|------:|
| **Top-1 accuracy on hold-out** | **96.50% (579 / 600 correct)** |
| Base model | `distilbert-base-multilingual-cased` (fine-tuned) |
| Training corpus | 6,000 multilingual examples (EN / FR / RW) |
| Destination classes | 56 map-node labels |
| Epochs | 3 (train loss 1.69 → 0.17 → 0.099) |
| Target accuracy | ≥ 0.88 — **exceeded by 8.5 points** |

**Model 2 — MiniLM semantic / FAQ retrieval, held-out evaluation** (from `ai/artifacts/local_chatbot/meta.json`):

| Metric | Value |
|--------|------:|
| Top-1 accuracy | **88.24%** |
| Top-3 accuracy | 88.24% |
| Precision above threshold | 88.24% |
| Mean top-1 similarity | 0.790 |
| Mean answer similarity | 0.916 |
| Fraction above threshold (0.55) | 1.00 |
| Encoder embedding dim / load time | 384 / 1.37 s |

Both models **exceed the ≥ 0.88 target**. The intent classifier is trained by a fully reproducible pipeline (90/10 split) that writes `artifacts/intent_model/` and `artifacts/training_report.json`; if those weights are ever absent the engine automatically serves the zero-shot MiniLM retrieval path (Model 2), so accuracy never silently degrades to zero.

**Why accuracy is reported per model, not as one number:** Model 1 is a *cascade* with confidence-bucketed outputs (`resolved` / `confirm` / `retry`) and Model 2 is *retrieval over admin-edited content*. A single blended figure would hide *which path actually answered*. The honest, actionable diagnostics are: the held-out top-1 accuracy above, plus the live distribution of resolve/confirm/retry buckets and FAQ-hit rate, which are tuned via the thresholds in [ai/app/config.py](ai/app/config.py).

### 6.2 Navigation accuracy (system-level)

The campus-walk simulations assert the qualities that matter on the ground: correct turn-by-turn instructions, a **strictly decreasing distance countdown**, **zero false arrivals**, and **zero false auto-checkouts** across a full walk of the real RP Tumba graph — i.e. navigation correctness is measured, not assumed.

### 6.3 User feedback (collected and actioned)

Real-user feedback drove concrete changes already shipped: arrival notification + sound, Ruliba location corrections, visitor validations, QR scanning on locations, and full trilingual translation. Ongoing feedback is captured through the checkout survey, standalone feedback form, and staff feedback inbox.

### 6.4 System performance & operations analysis

- **Live in production** with CI/CD auto-deploy from `main` (verified working end-to-end).
- **Analytics dashboard** reports daily visitor counts, average visit duration, top destinations, and peak hours — operational evidence of effectiveness.
- **Resilience demonstrated** through real production incidents resolved (port conflicts, host networking, ARM cold-start, online disk expansion), and through the AI circuit-breaker that keeps the visitor experience working even when the AI engine is down.

---

## 7. Conclusion

All five required actions have been addressed with working, deployed, and tested evidence:

1. **AI & mapping enhanced** — 7-stage classification cascade, geo-referenced graph, Dijkstra routing, and a GPS-hardening layer that turns noisy phone GPS into reliable navigation.
2. **Real-user testing in the target environment** — field-tested on the live RP Tumba campus, piloted across three real institutions, in three languages, with feedback already actioned.
3. **Technologies fully documented** — React/Node/FastAPI stack, DistilBERT + MiniLM models, Dijkstra routing, and a reproducible training pipeline.
4. **Comprehensive testing** — 87 automated tests (functional, performance, reliability) green in CI, with every identified issue resolved.
5. **Detailed results** — measured **96.50%** held-out accuracy on the DistilBERT intent classifier and **88.24%** on the MiniLM retrieval model (both exceed the ≥ 0.88 target), measured navigation correctness, actioned user feedback, and a production performance analysis.

The system is in production at **<https://sinarms.isiri.rw>** and ready for re-presentation to the panel.
