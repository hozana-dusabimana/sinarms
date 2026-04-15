import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = ROOT_DIR / "artifacts"
DATA_DIR = ROOT_DIR / "data"

INTENT_MODEL_DIR = ARTIFACTS_DIR / "intent_model"
INTENT_LABELS_FILE = ARTIFACTS_DIR / "intent_labels.json"

BACKEND_URL = os.environ.get("SINARMS_BACKEND_URL", "http://127.0.0.1:4000")
AI_HOST = os.environ.get("AI_HOST", "127.0.0.1")
AI_PORT = int(os.environ.get("AI_PORT", "8000"))

# Model ids
DISTILBERT_BASE = os.environ.get(
    "SINARMS_DISTILBERT_BASE", "distilbert-base-multilingual-cased"
)
MINILM_MODEL = os.environ.get(
    "SINARMS_MINILM_MODEL",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)

# Classification thresholds — tuned for short visitor queries.
# Cosine similarity on 1–5-word prompts rarely exceeds ~0.75 even for perfect
# matches, so the original 0.80 "resolve" cutoff meant almost every embedding
# hit fell through to "confirm". These values keep confirmation for genuinely
# ambiguous inputs without gating correct answers.
CONFIDENCE_RESOLVE = float(os.environ.get("SINARMS_CONFIDENCE_RESOLVE", "0.68"))
CONFIDENCE_CONFIRM = float(os.environ.get("SINARMS_CONFIDENCE_CONFIRM", "0.40"))
FAQ_MATCH_THRESHOLD = float(os.environ.get("SINARMS_FAQ_THRESHOLD", "0.55"))

# Blend weight for the fine-tuned DistilBERT vote when combined with the
# embedding retrieval score. Retrieval stays primary because it always reflects
# the current facility graph; the classifier can drift out of sync when admins
# edit the map between retrainings.
FINE_TUNED_BLEND_WEIGHT = float(os.environ.get("SINARMS_FT_BLEND_WEIGHT", "0.3"))
