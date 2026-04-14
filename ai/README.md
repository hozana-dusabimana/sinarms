# SINARMS AI Engine

Python FastAPI service that powers the two AI models described in the SINARMS
design document.

- **Model 1 — Intent / Destination Classifier** — multilingual DistilBERT
  (`distilbert-base-multilingual-cased`). Maps free-text visitor input in
  English, French, or Kinyarwanda to a destination node in the facility map.
- **Model 2 — FAQ Matcher** — pre-trained
  `sentence-transformers/all-MiniLM-L6-v2` (80 MB, 384-dim, per SINARMS design
  document). Embeds user questions and finds the closest FAQ answer by cosine
  similarity; answers are returned when cosine ≥ 0.75.

When fine-tuned DistilBERT weights are not present on disk the classifier
falls back to **zero-shot multilingual embedding matching** against the node
labels and aliases, so the full pipeline works immediately (no training step
required to boot the service). After fine-tuning the service switches to the
trained head automatically.

## Project layout

```
ai/
├── app/          FastAPI server wiring
│   ├── main.py           HTTP endpoints
│   ├── config.py         environment + thresholds
│   ├── state.py          in-memory maps & FAQ
│   ├── backend_client.py Node.js client
│   └── router.py         Dijkstra path planner
├── models/       ML models (see models/README.md)
│   ├── base.py
│   ├── embeddings.py     shared MiniLM encoder
│   ├── intent_classifier.py  Model 1
│   └── faq_matcher.py        Model 2
├── training/     dataset generation + fine-tuning
├── data/         generated training corpus
├── artifacts/    trained weights + reports
└── tests/        pytest suite (no network required)
```

## Endpoints

| Method | Path                  | Purpose                                   |
| ------ | --------------------- | ----------------------------------------- |
| GET    | `/healthz`            | Liveness + which models are loaded        |
| POST   | `/ai/classify-intent` | Classify destination text to a node id     |
| POST   | `/ai/calculate-route` | Compute Dijkstra path on the facility graph |
| POST   | `/ai/chatbot`         | FAQ retrieval (MiniLM) with nav fallback  |
| POST   | `/ai/refresh-graph`   | Push updated map(s) from Node.js          |
| POST   | `/ai/refresh-faq`     | Push updated FAQ list from Node.js        |

The AI engine binds to `http://127.0.0.1:8000` by default. The Node.js backend
calls it at `AI_ENGINE_URL` and auto-pushes fresh maps/FAQ whenever an admin
edits them. If the engine is unreachable the backend falls back to its
deterministic matcher.

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
Node.js backend. The trainer generates a multilingual dataset from the node
aliases and phrase templates, optionally mixes in Kaggle paraphrase pairs, then
fine-tunes DistilBERT for 3–5 epochs.

```bash
# 1. Make sure the Node.js backend is running and maps are seeded.
#    Alternative: use --seed-file to pass the map JSON directly.

# 2. (Optional) Download Kaggle + HuggingFace supplementary data.
#    Requires ~/.kaggle/kaggle.json with a valid API token.
python -m training.download_kaggle
# Override the default datasets:
# python -m training.download_kaggle --kaggle <owner>/<dataset> --hf <hf_name>

# 3. Generate the training corpus (data/intent_dataset.jsonl).
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

The `ai/resync` hit reloads the new weights and also pushes the latest map +
FAQ snapshots from Node.js into the engine.

## Tests

```bash
python -m pytest tests/
```

The pytest suite runs without internet access — the classifier/FAQ matcher
both fall back to token overlap scoring if the embedding model cannot be
loaded, so CI is deterministic.
