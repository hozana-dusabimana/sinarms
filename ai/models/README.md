# `ai/models/` — ML model modules

This package holds every model the SINARMS AI engine serves. The FastAPI
layer in [`ai/app/`](../app/) only wires HTTP → model calls; all inference
logic lives here.

## Layout

| File                    | Purpose                                                   |
| ----------------------- | --------------------------------------------------------- |
| `base.py`               | Shared conventions (`ModelProtocol`, helper responses)    |
| `embeddings.py`         | Singleton loader for the shared MiniLM sentence encoder   |
| `intent_classifier.py`  | **Model 1** — destination / intent classifier             |
| `faq_matcher.py`        | **Model 2** — FAQ retrieval by cosine similarity          |

## Model 1 — Intent / Destination Classifier

Maps free-text visitor input (EN / FR / RW) to a destination node on the
facility graph.

- **Primary:** fine-tuned `distilbert-base-multilingual-cased` loaded from
  `artifacts/intent_model/` after training.
- **Zero-shot fallback:** cosine similarity of the query against each node's
  labels and aliases using the shared MiniLM encoder.
- **Offline fallback:** dictionary token-overlap so the endpoint always works.

Returns one of `resolved` / `confirm` / `retry` based on the thresholds in
[`app/config.py`](../app/config.py) (`CONFIDENCE_RESOLVE`,
`CONFIDENCE_CONFIRM`).

Train it with `python -m training.train_intent`.

## Model 2 — FAQ Matcher

Ranks FAQ entries by cosine similarity against the visitor query using the
MiniLM encoder. Answers are returned when cosine ≥ `FAQ_MATCH_THRESHOLD`
(0.75 per the design document). FAQ embeddings are cached in memory and
rebuilt when the backend pushes an updated list via `/ai/refresh-faq`.

## Conventions

Every model module exposes:

- a public inference function (`classify` / `answer`) returning a JSON-
  serialisable dict;
- `invalidate_cache()` — drop cached embeddings when the backend pushes a
  fresh map / FAQ snapshot;
- optionally `models_loaded()` — `{name: bool}` used by `/healthz`.

See [`base.py`](base.py) for the protocol.
