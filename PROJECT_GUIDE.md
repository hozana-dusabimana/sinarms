# SINARMS — Project Guide (Supervisor Briefing)

## The 30-second pitch

**SINARMS** (Smart Institutional Navigation and Resource Mapping System) is a multi-tenant visitor management and indoor/campus navigation platform built for Ruliba Clays Ltd (and also seeded with RP Tumba College and Qonics). A visitor checks in from their phone — no login, no app install — states a destination in plain English, French, or Kinyarwanda, and gets live GPS turn-by-turn navigation across the campus. Staff see visitors in real time, get security alerts, and manage everything from a web dashboard. **It is live in production** at https://sinarms.isiri.rw with CI/CD auto-deploy from `main`.

## Architecture (3 services + DB, Docker-composed)

| Tier | Stack | Role |
|---|---|---|
| Frontend | React 19 + Vite + Leaflet + Tailwind | Visitor portal & staff/admin dashboard (SPA) |
| Backend | Node.js + Express 5 + Socket.IO + MySQL | API, auth, routing fallback, business rules |
| AI engine | Python FastAPI + DistilBERT + MiniLM | Intent classification, FAQ matching, Dijkstra routing |

One `docker compose up --build` runs the whole stack; the backend auto-migrates and seeds on first boot.

## Likely questions & quick answers

### "What problem does it solve?"

Visitors at institutions waste time finding offices and reception can't track who's on site. SINARMS replaces paper logbooks with digital self check-in (QR or web), AI-assisted destination finding, live GPS navigation, automated security alerts (GPS lost, restricted zone, idle, long stay, no-show), and analytics — all multi-tenant so one deployment serves many organizations.

### "Where is the AI? Is it real AI or just if-statements?"

Two genuine ML models, plus a trained pipeline:

- **Intent classifier**: fine-tuned `distilbert-base-multilingual-cased` over destination nodes, blended (weight 0.3) with zero-shot **MiniLM** (`paraphrase-multilingual-MiniLM-L12-v2`) cosine-similarity over node aliases. 7-layer fallback cascade ending in token-overlap so it never dies offline.
- **FAQ matcher**: MiniLM sentence embeddings, cosine similarity, threshold 0.55, org-scoped.
- **Training pipeline**: generates ~6,000 multilingual training phrases from the live map graph (35 templates: 14 EN / 11 FR / 10 RW) with augmentation (synonyms, reordering, fillers), optionally enriched with Kaggle Quora question pairs and Tatoeba English–Kinyarwanda data. Trains 3 epochs, batch 16, lr 5e-5, 90/10 split, target accuracy ≥ 0.88.
- Thresholds: resolve ≥ 0.68, confirm ≥ 0.40, below that ask to rephrase.

### "What if the AI service is down?"

Graceful degradation by design. The Node backend has a 1.5s (4s in prod) timeout and a 30s circuit breaker; it falls back to its own deterministic alias matcher and local **Dijkstra** routing, returning the identical response shape. Visitors never see an AI error. The AI engine also self-heals on startup (retries backend fetch for ~2 min, pre-warms the encoder).

### "How does navigation work?"

The campus is a graph (`map_nodes` / `map_edges` in MySQL) with x,y schematic coordinates geo-referenced to real lat/lng (origin point + footprint + rotation). Routes come from Dijkstra with turn-by-turn instructions derived from compass bearings between nodes. On the phone, a custom GPS hook does outlier rejection (>35 m/s impossible-speed fixes dropped), accuracy-weighted smoothing, 2-fix movement confirmation, and snap-to-route within 18m. Off-site, it fetches a real-road approach route from OSRM until the visitor is within 350m of the entrance. Arrival triggers a chime + speech announcement.

### "How do you know it works?"

Three test suites, all green in GitHub CI: **31 backend Jest tests** (auth, tenant scoping, geofence, alerts, sockets, reroute), **AI pytest integration tests** (multilingual classification, Dijkstra, FAQ, deterministic/no-network), and **Vitest simulation tests** that replay a virtual visitor walking the real seeded RP Tumba campus with synthetic GPS fixes at 1.6 m/s — asserting instructions, monotonic distance countdown, no false arrivals, and no false auto-checkout.

### "Is it deployed?"

Yes — live in production on an AWS EC2 ARM64 host behind Cloudflare TLS and CloudPanel:

- https://sinarms.isiri.rw (frontend) · https://api-sinarms.isiri.rw (API) · https://ai-sinarms.isiri.rw (AI)
- CI/CD: path-scoped GitHub Actions auto-deploy on push to `main` (verified working).
- Real production debugging done: port conflicts with a co-hosted app, Docker host networking for MySQL, ARM cold-start encoder timeouts, disk expansion (9GB→60GB online resize), Vite OOM on the small box.

### "Security?"

JWT auth (8h expiry) in HTTP-only cookies + bcrypt password hashes; role-based access (admin / receptionist) with a granular JSON permission model; strict tenant scoping enforced server-side (receptionists only ever see their own org+location); full immutable audit log (actor, action, target, IP); internal AI-sync endpoints are localhost-only; QR check-in validates a per-location token.

### "What's the geofencing story?"

Per-organization toggle (`distanceCheckEnabled`). Check-in requires being within 100m of the entrance (Haversine); auto-checkout fires after 30 continuous seconds beyond 120m — the hysteresis gap plus raw-GPS checks prevent flapping. Staff manual check-ins bypass it.

### "Multilingual?"

End to end: UI fully translated (English, French, Kinyarwanda — ~5,800 translation keys), and the ML models are multilingual by architecture, with Kinyarwanda training templates ("ndashaka", "icyumba", "ibiro"…).

### "What was the hardest part?"

1. **GPS noise** — coarse Wi-Fi fixes caused phantom route progress and false instant arrivals; solved with accuracy-weighted blending, movement-confirmation streaks, and starting routes at the node nearest the actual fix (the recent nav-hardening commits, all backed by simulation tests).
2. **Cold-start AI in production** — first queries on the ARM server exceeded the backend's AI budget and tripped the circuit breaker; fixed with a startup warm-up thread.
3. **Tenant isolation** — making sure a receptionist can never leak another org's visitors, enforced in the domain layer and covered by dedicated tests.

### "What would you improve / future work?"

Push real-time updates to the staff dashboard over Socket.IO (server already emits all events; frontend currently polls every 10s), real speech-to-text for the assistant (currently a stub), use the `language` hint in AI queries, indoor positioning (Wi-Fi/BLE) where GPS fails, and pre-computed analytics aggregation.

## Key numbers to have ready

- **106 commits**; 16 backend test files (~1,400 lines of tests) + AI + frontend sims
- **13 DB tables**, ~40 API endpoints, 16 frontend routes (4 visitor, 6 staff, 6 admin)
- Models: DistilBERT multilingual (fine-tuned) + MiniLM-L12-v2; FAQ threshold 0.55, resolve 0.68
- Demo login: `admin@sinarms.rw` (receptionist demo accounts per org are listed in the README)
- Seeded: 2+ organizations, 4 locations, 4 maps, 8 FAQs
