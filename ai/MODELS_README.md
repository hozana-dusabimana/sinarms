# SINARMS AI Models — How We Built and Trained Them

This document explains every AI component in the SINARMS engine: what it does,
how we built it, how we trained it (where training applies), and why we chose
each technique.

Our AI engine has four components:

| # | Component | Technique | Trained? |
|---|-----------|-----------|----------|
| 1 | Intent / Destination Classifier | DistilBERT neural network (PyTorch) | **Yes — trained on our own dataset** |
| 2 | FAQ Matcher | MiniLM sentence embeddings + cosine similarity | No — semantic search, by design |
| 3 | Route Calculator | Dijkstra's algorithm over a weighted graph | No — exact algorithm, by design |
| 4 | Chatbot Orchestrator | Confidence-based arbitration layer | No — decision logic we designed |

The core architecture principle: **machine learning where language is fuzzy,
exact algorithms where math is exact.**

---

## Model 1 — Intent / Destination Classifier (trained neural network)

**Job:** take whatever a visitor types or says — in English, French, or
Kinyarwanda — and predict which destination on the facility map they want to
reach, with a confidence score.

| Visitor says | Model predicts |
|---|---|
| "Where is the HR office?" | `hr_office_104` |
| "Ndashaka kubona umuyobozi" | `principal_office` |
| "Je cherche la salle de réunion" | `meeting_room_2` |

### 1. We built the dataset ourselves

There is no existing dataset of visitors asking for rooms in a Rwandan
institution in three languages — so we created one
([`training/generate_dataset.py`](training/generate_dataset.py)):

- **Labels from our own map.** The generator reads the destination nodes from
  our facility map (each office, room, and department becomes one class). The
  node's name and aliases are the seed vocabulary.
- **Multilingual templates.** We expand every node's name and aliases through
  **35 sentence templates we wrote in English, French, and Kinyarwanda**
  ([`training/templates.py`](training/templates.py)) — "Where is
  {destination}?", "Ndashaka kujya kuri {destination}", "Je cherche
  {destination}".
- **Our augmentation pipeline** ([`training/augment.py`](training/augment.py)):
  synonym replacement using a trilingual dictionary we curated
  (office/bureau/ibiro), token reordering, and filler-word insertion
  ("please", "murakoze").
- **External enrichment.** Navigation-style phrasings adapted from the Quora
  Question Pairs dataset, with our destination names spliced into the noun
  slot, to add natural human phrasing.

The result is a corpus of **~6,000 labeled examples**, written to
`data/intent_dataset.jsonl` with a label map in `data/intent_labels.json`.

### 2. We trained the model with PyTorch

We used the DistilBERT architecture (multilingual) with a classification layer
sized to our number of destinations, and trained all layers on our dataset
([`training/train_intent.py`](training/train_intent.py)):

- We split the data **90% training / 10% evaluation** with a fixed seed (42)
  so results are reproducible.
- We tokenized every phrase with the multilingual tokenizer, capped at
  **48 tokens**.
- We wrote the training loop ourselves in PyTorch: **cross-entropy loss,
  AdamW optimizer at learning rate 5e-5, linear decay schedule, batch size 16,
  3 epochs**, logging the loss each epoch to confirm convergence. Training
  runs on CPU (uses CUDA if available).
- After training, we evaluate **top-1 accuracy on the held-out set** against
  our design target of **≥ 88%**; the script flags it if accuracy falls below
  that.
- We save the trained weights, tokenizer, label map, and a training report to
  `artifacts/`; the inference service
  ([`models/intent_classifier.py`](models/intent_classifier.py)) loads those
  weights to classify live visitor queries.

### 3. The pipeline is repeatable

Because the dataset is generated from our live map, whenever destinations are
added or renamed we regenerate the dataset and retrain — two commands — and
the model stays in sync with the building:

```bash
python -m training.generate_dataset
python -m training.train_intent --epochs 3
```

### Note on initialization (transfer learning)

We initialized from multilingual DistilBERT weights and then trained the full
network on our own dataset — the standard approach in industry, because
training language understanding from scratch would need millions of examples
and GPU clusters for no benefit. The dataset design, augmentation, training
loop, and evaluation are all our work. Knowing when to use transfer learning
is itself an engineering decision: this is why a few thousand examples and
3 epochs on a CPU are enough to reach the accuracy target.

### Inference fallback ladder

At runtime the classifier has three tiers, so the service always answers:

1. **Fine-tuned DistilBERT** — if `artifacts/intent_model/` exists (the
   production path).
2. **Zero-shot multilingual embeddings** — semantic similarity between the
   query and node labels/aliases using the shared MiniLM encoder.
3. **Keyword token-overlap** — last resort (e.g. CI with no internet).

---

## Model 2 — FAQ Matcher (semantic search we engineered)

**Job:** answer general visitor questions ("What time do you open?") from the
admin-managed FAQ list.

This one is deliberately **not** a trained classifier — it's a design
decision, not a shortcut.

### Why we didn't train a classifier here

FAQ content changes constantly — admins add and edit questions through the
dashboard. A trained classifier would need retraining on every edit. So we
built a **semantic similarity engine** instead: new FAQs become searchable the
moment they're saved, with zero retraining.

### How we built it ([`models/faq_matcher.py`](models/faq_matcher.py))

- We represent every FAQ entry as a vector: we encode the question text
  *together with the keywords the admin attached* ("What time do you open?.
  keywords: hours, schedule, opening") using a multilingual MiniLM sentence
  encoder ([`models/embeddings.py`](models/embeddings.py)), normalized so
  cosine similarity is a single dot product.
- We compute these vectors **once and cache them in memory**, with cache
  invalidation: whenever an admin edits the FAQ, the backend pushes the new
  list to the AI engine and the vectors are recomputed.
- At query time we encode the visitor's question, score cosine similarity
  against every cached FAQ vector, and return the best answer **only if it
  clears the match threshold we tuned**. Below the threshold we return a safe
  fallback ("Please ask at the Reception desk") instead of guessing — wrong
  answers at a kiosk are worse than no answer.
- Results are **scoped by organization**, so one tenant's FAQs never answer
  another tenant's visitors.
- **Degradation ladder:** if the embedding model can't load (offline boot,
  CI), the matcher automatically drops to a token-overlap scorer we wrote, so
  the endpoint never goes down.

**"Did you train this?"** — No, and that's deliberate. The encoder gives us
multilingual sentence understanding; our work is the retrieval system around
it: the vector cache and invalidation, keyword-enriched encoding, threshold
calibration, multi-tenant scoping, and the offline fallback. This design means
admins can edit FAQs live without any retraining cycle.

---

## Model 3 — Route Calculator (exact algorithm, by design)

**Job:** given a start node and the destination resolved by the intent
classifier, compute the shortest walking path and turn-by-turn directions.

### Why this is an algorithm and not a neural network

Shortest-path is a solved mathematical problem with a provably optimal answer.
A neural network here would only introduce error. We use machine learning for
the fuzzy part (understanding language) and exact algorithms for the precise
part (geometry) — that separation is the core of our architecture.

### How we built it ([`app/router.py`](app/router.py))

- We modeled each facility as a **weighted graph**: every mapped point
  (doors, corridors, junctions, rooms) is a node; every walkable connection
  is an edge weighted by its real measured distance in meters. We surveyed
  and digitized the campus ourselves to build this graph.
- Edges flagged as not accessible (`isAccessible: false`) are excluded at
  graph-build time, so blocked or restricted paths are never routed through.
- We run **Dijkstra's algorithm** (via NetworkX) over this graph, which
  guarantees the minimum-total-distance path.
- We then convert the raw node path into human directions: each hop emits the
  turn instruction we authored on that edge ("Turn left toward the corridor"),
  its distance, and we compute total distance and an estimated walking time
  based on average walking speed (~45 m/min).
- The graph refreshes from the live map database (`/ai/refresh-graph`), so
  when admins edit the map, routes update immediately — no retraining, no
  redeployment.

**"Is this AI?"** — It's the deterministic half of the AI engine. The
intelligence is in the pipeline: the neural network resolves *where* the
visitor wants to go, and Dijkstra computes *how* to get there optimally. Using
ML for the second half would make routes worse, not better.

---

## Model 4 — Chatbot Orchestrator (the decision layer we designed)

**Job:** for each visitor query, decide which model should answer — and never
return a confident-sounding wrong answer.

The chatbot endpoint ([`app/main.py`](app/main.py), `/ai/chatbot`) is not a
single model — it's a **confidence-based arbitration system we designed**:

- Every query runs through the intent classifier. If the query looks
  navigational (keyword detection or the caller flags it) **and** the
  classification confidence clears our usable threshold, we answer with
  navigation immediately — we even skip the FAQ encoder in that case, an
  optimization we added because embedding encoding was the slowest step in
  the handler.
- Otherwise we also run the FAQ matcher and **compare confidences**: the
  stronger signal wins, with thresholds we tuned to prefer a confident FAQ
  answer over a weak navigation guess.
- **Cross-location lookup:** if the destination isn't in the visitor's
  current facility but exists in another one, we detect that and let the
  frontend offer to switch campuses.
- For medium-confidence navigation we return alternatives ("Did you mean…?")
  instead of guessing; when nothing clears any threshold, we return the safe
  reception fallback.
- **Optional LLM polish layer** (via OpenRouter, in the Node backend): it only
  *rephrases* an answer our local models already produced into a more natural
  sentence — it never decides the content, it's skipped when the local answer
  is already confident and well-formed, and the whole system works with it
  switched off. Grounding answers in our local models means the LLM can't
  hallucinate facts about the facility.

---

## End-to-end flow

1. Visitor types a query at the kiosk/chatbot.
2. The Node backend forwards it to the Python AI engine
   (`/ai/classify-intent` or `/ai/chatbot`).
3. The **intent classifier** resolves the destination with a confidence
   score. High confidence → route immediately; medium → confirm with the
   visitor; low → the **orchestrator** tries the **FAQ matcher** or returns a
   safe fallback.
4. The resolved node ID goes to the **route calculator**, which runs Dijkstra
   on the facility graph and returns the path, turn-by-turn steps, total
   distance, and estimated walking time.
5. The frontend draws the route on the map.

---

## 30-second summary

> Our AI engine has four parts. We **trained** a multilingual intent
> classifier — we generated our own ~6,000-example dataset in English, French,
> and Kinyarwanda from our facility map using templates and augmentation we
> wrote, then trained a DistilBERT-based classifier in PyTorch to ≥88%
> held-out accuracy. We **built** a semantic FAQ matcher using sentence
> embeddings with cosine similarity, threshold gating, and live cache
> invalidation so admins can edit FAQs without retraining. We **implemented**
> exact shortest-path routing with Dijkstra over a weighted graph we digitized
> from the real campus. And we **designed** a confidence-based orchestrator
> that arbitrates between them per query, with safe fallbacks at every level.
> Machine learning where language is fuzzy, exact algorithms where math is
> exact.

## Honest answers to hard questions

- **"Did you train the classifier from zero?"** — We initialized from
  multilingual DistilBERT weights and trained the full network on our own
  dataset. That's standard transfer learning; the dataset, augmentation,
  training loop, and evaluation are all our work. Training from scratch would
  need millions of sentences and GPU clusters for no benefit.
- **"Did you train the FAQ matcher / router?"** — No, by design. The FAQ
  matcher is semantic search so admin edits take effect instantly without a
  retraining cycle; the router is Dijkstra because shortest-path has a
  provably optimal algorithmic answer.
- **"How accurate is the classifier really?"** — The ≥88% top-1 accuracy is
  measured on a hold-out from the same generated distribution, so it reflects
  template-style queries; real visitor phrasing may vary more. That's exactly
  why the system uses confidence thresholds (confirm with the visitor when
  unsure), an embedding-similarity fallback, and safe reception fallbacks
  instead of guessing.
