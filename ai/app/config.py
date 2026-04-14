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
    "sentence-transformers/all-MiniLM-L6-v2",
)

# Classification thresholds (mirror the Node.js logic and design doc).
CONFIDENCE_RESOLVE = 0.80
CONFIDENCE_CONFIRM = 0.50
FAQ_MATCH_THRESHOLD = 0.75
