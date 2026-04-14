"""Shared multilingual sentence-embedding encoder.

Both the intent classifier (zero-shot fallback path) and the FAQ matcher use
the same MiniLM model. Loading it once here keeps only one copy of the weights
in memory and centralises the graceful-degradation behaviour used when the
model cannot be downloaded (CI, offline boot).
"""
from __future__ import annotations

import logging
import threading
from typing import Optional

from app.config import MINILM_MODEL

LOGGER = logging.getLogger(__name__)

_lock = threading.Lock()
_model = None
_load_attempted = False


def get_encoder():
    """Return the cached ``SentenceTransformer`` or ``None`` if unavailable.

    The first failed load is remembered so repeated calls don't keep retrying
    a download that already failed.
    """
    global _model, _load_attempted

    with _lock:
        if _model is not None or _load_attempted:
            return _model

        _load_attempted = True
        try:
            from sentence_transformers import SentenceTransformer  # noqa: WPS433

            _model = SentenceTransformer(MINILM_MODEL)
            LOGGER.info("Loaded multilingual MiniLM embeddings (%s).", MINILM_MODEL)
            return _model
        except Exception as error:  # pragma: no cover - only hit offline
            LOGGER.warning("Could not load embedding model: %s", error)
            return None


def is_loaded() -> bool:
    return _model is not None


def reset_for_tests() -> None:  # pragma: no cover - used by conftest if needed
    global _model, _load_attempted
    with _lock:
        _model = None
        _load_attempted = False


__all__ = ["get_encoder", "is_loaded", "reset_for_tests"]
