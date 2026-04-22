# SINARMS AI Engine

Python **FastAPI** service that powers the two AI models described in the
SINARMS design document, plus the shortest-path router used by the visitor
navigation flow. It runs as a sidecar to the Node.js backend — Node remains
the source of truth for maps and FAQ; this service only holds in-memory
snapshots and ML weights.

---

## What we have built

This is a summary of everything in this folder so a reviewer can tell what
was actually implemented (as opposed to what the design document asks for).

### 1. Model 1 — Intent / Destination Classifier
File: [models/intent_classifier.py](models/intent_classifier.py)

Maps free-text visitor input (English / French / Kinyarwanda) to a node id
on the live facility graph. The classifier is **layered** — it tries the
cheapest, most precise path first and only falls back when earlier paths are
not confident enough:

1. **Literal / fuzzy alias match** — if the query literally contains a node
   label or alias (or contains it with up to 1–2 character typos via
   Levenshtein), we resolve immediately at 0.85–0.95 confidence. This
   prevents a stale ML model from hallucinating alternatives when the user
   spelled the destination out (e.g. "hr office", "receiption").
2. **Acronym shortcut** — short one-token queries like `hr`, `md`, `it`,
   `ceo`, `cfo`, `pa` are expanded to known acronym targets, and any other
   2–4 character token that uniquely identifies exactly one node is resolved
   directly.
3. **Fine-tuned DistilBERT** (`distilbert-base-multilingual-cased`) — if
   `artifacts/intent_model/` exists it is loaded once and cached; softmax
   probabilities over the graph's node ids are used as a supporting signal.
4. **Multilingual MiniLM embeddings** (zero-shot retrieval) — every alias on
   the graph is encoded once (cached per location) and the query is scored
   by cosine similarity. This is the **authoritative** path because it
   always reflects the current graph, even right after an admin edits it.
5. **Blending** — when both the fine-tuned classifier and embeddings fire,
   we combine them with `FINE_TUNED_BLEND_WEIGHT` (default `0.3`), keeping
   retrieval dominant so a stale classifier cannot outvote the live graph.
6. **Token-overlap dictionary fallback** — used only when no ML model can be
   loaded at all (offline CI, first boot without internet). Guarantees the
   endpoint always returns something useful.
7. **Cross-location search** — `classify_across_locations()` scans every
   loaded facility map so the chatbot can answer "where is the HR office?"
   even when the visitor is currently at a different building. Results are
   tagged with `crossLocation: true` so the frontend can offer to switch.

Confidence is bucketed into three statuses by thresholds in
[app/config.py](app/config.py):

| Status     | Cutoff                              | Behaviour                                 |
| ---------- | ----------------------------------- | ----------------------------------------- |
| `resolved` | `CONFIDENCE_RESOLVE` = 0.68         | Return the winning node directly          |
| `confirm`  | `CONFIDENCE_CONFIRM` = 0.40         | Ask the visitor to pick from alternatives |
| `retry`    | below `CONFIDENCE_CONFIRM`          | Ask the visitor to rephrase               |

These are lower than the design doc's 0.80 "resolve" cutoff because short
1–5 word prompts rarely break 0.75 cosine even on correct matches.

### 2. Model 2 — FAQ Matcher
File: [models/faq_matcher.py](models/faq_matcher.py)

Ranks FAQ entries by cosine similarity using the same MiniLM encoder:

- every FAQ is encoded as `"<question>. keywords: <k1, k2, …>"` on first
  use and cached in memory, keyed by the FAQ id list so a push from
  `/ai/refresh-faq` invalidates the cache automatically;
- scoped per organization (entries with a matching `organizationId` or no
  org restriction are considered);
- returns the answer when cosine ≥ `FAQ_MATCH_THRESHOLD` (default `0.55`),
  otherwise returns a "not sure, ask at reception" fallback;
- same offline fallback — token-overlap Jaccard scoring — so CI with no
  network still produces deterministic answers.

### 3. Shared MiniLM encoder
File: [models/embeddings.py](models/embeddings.py)

Singleton loader for `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`.
Loaded once, shared across both models so there is only one copy of the
weights in memory. First failed load is remembered so repeated calls do not
keep retrying a download that already failed.

### 4. Shortest-path router
File: [app/router.py](app/router.py)

Dijkstra over the facility graph with NetworkX:

- edges marked `isAccessible: false` are skipped (locked doors, closed
  corridors);
- `distanceM` is the edge weight;
- returns `pathNodeIds`, step-by-step instructions (using each edge's
  `directionHint` / `direction`), total metres, and an estimated time at
  a 45 m/min walking speed.

### 5. FastAPI wiring
File: [app/main.py](app/main.py)

- `startup` hook pulls maps from the Node.js backend's public bootstrap
  endpoint and FAQ from the localhost-only `/api/internal/ai-state`
  endpoint (see [app/backend_client.py](app/backend_client.py));
- `/ai/chatbot` fuses intent + FAQ: it picks navigation when a nav keyword
  regex fires or the classifier is confident, otherwise the FAQ answer if
  its confidence clears 0.55, otherwise a cross-location hint, otherwise
  the classifier's alternatives — i.e. a deliberate priority cascade
  rather than a single-model vote;
- `/ai/refresh-graph` and `/ai/refresh-faq` let the Node.js admin UI push
  fresh data without restarting the engine; both invalidate the relevant
  model cache.

### 6. Training pipeline
Folder: [training/](training/)

End-to-end reproducible pipeline that trains DistilBERT from the live
facility graph:

| File                       | Purpose                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `templates.py`             | EN / FR / RW phrase templates plus small synonym dictionary                            |
| `augment.py`               | Offline, reproducible augmentation (synonym swap, token reorder, filler injection)     |
| `generate_dataset.py`      | Pulls the map, expands labels/aliases against templates, writes `intent_dataset.jsonl` |
| `download_kaggle.py`       | Optional Kaggle (Quora pairs) + HuggingFace (Tatoeba eng-kin) paraphrase downloader    |
| `train_intent.py`          | Fine-tunes `distilbert-base-multilingual-cased` for 3–5 epochs and evaluates top-1     |

The dataset generator additionally splices the facility aliases into
real Quora navigation-style questions ("How do I locate the {alias}?") to
teach the model real-world phrasings it would not otherwise see.

### 7. Backend integration
The Node.js side calls us via [backend/src/services/aiClient.js](../backend/src/services/aiClient.js):

- 1.5 s timeout per request, 30 s circuit-breaker if the engine is down —
  the Node.js backend transparently falls back to its deterministic
  matcher so visitors never see a failure;
- `/api/internal/ai/resync` on the backend re-pushes maps + FAQ and
  triggers a `/healthz` probe. This is what the retraining workflow
  calls after new weights land.

### 8. Tests
File: [tests/test_engine.py](tests/test_engine.py)

Six FastAPI TestClient tests that cover health, classification (EN + FR),
routing, chatbot navigation vs FAQ branching, and live graph refresh. They
run with **zero network access** because both models fall back to the
token-overlap path when MiniLM is unreachable, keeping CI deterministic.

---

## Project layout

```
ai/
├── app/                     FastAPI server
│   ├── main.py                HTTP endpoints + chatbot fusion logic
│   ├── config.py              env vars, thresholds, model ids
│   ├── state.py               in-memory MapGraph / FaqEntry store
│   ├── backend_client.py      Node.js bootstrap + internal-state client
│   └── router.py              Dijkstra path planner
├── models/                  ML inference
│   ├── base.py                Shared ModelProtocol + helper responses
│   ├── embeddings.py          MiniLM singleton
│   ├── intent_classifier.py   Model 1 (literal + DistilBERT + embeddings)
│   └── faq_matcher.py         Model 2 (MiniLM cosine retrieval)
├── training/                Dataset generation + DistilBERT fine-tuning
│   ├── templates.py           EN / FR / RW phrase templates
│   ├── augment.py             Offline augmentation
│   ├── generate_dataset.py    Build intent_dataset.jsonl from live graph
│   ├── download_kaggle.py     Optional Quora + Tatoeba downloader
│   └── train_intent.py        DistilBERT fine-tuning + hold-out eval
├── data/                    Generated corpus (intent_dataset.jsonl, labels)
├── artifacts/               Trained weights + training_report.json
├── tests/                   pytest suite (no network required)
└── requirements.txt
```

---

## Endpoints

| Method | Path                  | Purpose                                                    |
| ------ | --------------------- | ---------------------------------------------------------- |
| GET    | `/healthz`            | Liveness + which models are loaded + loaded locations/FAQ  |
| POST   | `/ai/classify-intent` | Classify destination text to a node id on a location       |
| POST   | `/ai/calculate-route` | Dijkstra path on the facility graph                        |
| POST   | `/ai/chatbot`         | Fused intent + FAQ answer, with cross-location fallback    |
| POST   | `/ai/refresh-graph`   | Push updated map(s) from Node.js (invalidates alias cache) |
| POST   | `/ai/refresh-faq`     | Push updated FAQ list (invalidates FAQ embedding cache)    |

Default bind: `http://127.0.0.1:8000`. The Node.js backend reaches it via
`AI_ENGINE_URL` and auto-pushes fresh maps/FAQ whenever an admin edits them.
If the engine is unreachable Node falls back to its deterministic matcher.

---

## Install

```bash
cd ai
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
python -m app.main
# or
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Train the intent classifier end-to-end

The classifier is trained from the **live facility graph** pulled from the
Node.js backend. The generator expands every node's label + aliases across
EN/FR/RW templates, augments them, and optionally mixes in Quora paraphrase
splicing; the trainer then fine-tunes DistilBERT for 3–5 epochs.

```bash
# 1. Make sure the Node.js backend is running and maps are seeded.
#    Alternative: use --seed-file to pass the map JSON directly.

# 2. (Optional) Download Kaggle + HuggingFace supplementary data.
#    Requires ~/.kaggle/kaggle.json with a valid API token.
python -m training.download_kaggle

# 3. Generate the training corpus (data/intent_dataset.jsonl + intent_labels.json).
python -m training.generate_dataset --base-url http://localhost:4000 --target-size 6000

# 4. Fine-tune DistilBERT. Writes artifacts/intent_model/ and
#    artifacts/training_report.json (accuracy, records, labels).
python -m training.train_intent --epochs 3
```

Typical CPU training time: 2–4 hours. Target top-1 accuracy: ≥ 0.88 on the
held-out 10% split. If the report shows lower accuracy:

- Add more aliases to the facility nodes in the admin UI (most common cause).
- Run `training.download_kaggle` to mix in paraphrases.
- Increase `--epochs` to 5 or `--target-size` to 8000.

## Retraining

The design document calls for monthly retraining:

```bash
python -m training.generate_dataset --base-url http://localhost:4000
python -m training.train_intent --epochs 3
curl -X POST http://127.0.0.1:4000/api/internal/ai/resync
```

`ai/resync` reloads the new weights on the engine and pushes the latest map
+ FAQ snapshots from Node.js.

## Tests

```bash
python -m pytest tests/
```

The pytest suite runs without internet access — the classifier and FAQ
matcher both fall back to token-overlap scoring when the embedding model
cannot be loaded, so CI is deterministic.

---

## Configuration

All values are environment-overridable (see [app/config.py](app/config.py)):

| Variable                       | Default                                                         | Purpose                                         |
| ------------------------------ | --------------------------------------------------------------- | ----------------------------------------------- |
| `SINARMS_BACKEND_URL`          | `http://127.0.0.1:4000`                                         | Node.js backend to pull maps + FAQ from         |
| `AI_HOST` / `AI_PORT`          | `127.0.0.1` / `8000`                                            | Bind address                                    |
| `SINARMS_DISTILBERT_BASE`      | `distilbert-base-multilingual-cased`                            | Base model for Model 1                          |
| `SINARMS_MINILM_MODEL`         | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`   | Shared encoder                                  |
| `SINARMS_CONFIDENCE_RESOLVE`   | `0.68`                                                          | Minimum cosine to skip the confirm step         |
| `SINARMS_CONFIDENCE_CONFIRM`   | `0.40`                                                          | Minimum cosine to surface alternatives at all   |
| `SINARMS_FAQ_THRESHOLD`        | `0.55`                                                          | Minimum cosine to return an FAQ answer          |
| `SINARMS_FT_BLEND_WEIGHT`      | `0.3`                                                           | Weight of fine-tuned vote when blended          |
