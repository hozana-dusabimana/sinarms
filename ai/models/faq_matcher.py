"""Model 2 — FAQ Matcher (MiniLM sentence embeddings).

Behaviour matches section 3.2 / 8.3 of the SINARMS design document:

- encode every FAQ question once (cached in memory) with the shared MiniLM
  encoder (see ``models.embeddings``);
- encode the visitor query and score cosine similarity against each FAQ;
- if the best match is above ``FAQ_MATCH_THRESHOLD`` return the answer;
- otherwise return a fallback advising the visitor to ask at reception.

If the embedding model cannot be loaded (e.g. first boot without internet) we
fall back to token-overlap scoring so the service still returns sensible
answers.
"""
from __future__ import annotations

import logging
import re
import threading
from typing import Any, Dict, List, Optional

import numpy as np

from app.config import FAQ_MATCH_THRESHOLD
from app.state import FaqEntry, state

from . import embeddings

LOGGER = logging.getLogger(__name__)

_lock = threading.Lock()
_faq_embeddings: Optional[np.ndarray] = None
_faq_embeddings_for: List[str] = []


def _ensure_embeddings() -> None:
    global _faq_embeddings, _faq_embeddings_for

    ids = [entry.id for entry in state.faq]
    if _faq_embeddings is not None and _faq_embeddings_for == ids:
        return

    encoder = embeddings.get_encoder()
    if encoder is None or not state.faq:
        _faq_embeddings = None
        _faq_embeddings_for = ids
        return

    texts = [
        f"{entry.question}. keywords: {', '.join(entry.keywords)}"
        for entry in state.faq
    ]
    try:
        _faq_embeddings = np.asarray(
            encoder.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
        )
        _faq_embeddings_for = ids
    except Exception as error:  # pragma: no cover
        LOGGER.warning("FAQ embedding failed: %s", error)
        _faq_embeddings = None
        _faq_embeddings_for = ids


def invalidate_cache() -> None:
    global _faq_embeddings, _faq_embeddings_for
    with _lock:
        _faq_embeddings = None
        _faq_embeddings_for = []


_WORD_RE = re.compile(r"[a-z0-9]+", re.IGNORECASE)


def _token_overlap(left: str, right: str) -> float:
    left_tokens = {token.lower() for token in _WORD_RE.findall(left or "")}
    right_tokens = {token.lower() for token in _WORD_RE.findall(right or "")}
    if not left_tokens or not right_tokens:
        return 0.0
    overlap = left_tokens & right_tokens
    if not overlap:
        return 0.0
    return len(overlap) / len(left_tokens | right_tokens)


def _scoped_faq(organization_id: Optional[str]) -> List[FaqEntry]:
    return [
        entry
        for entry in state.faq
        if not entry.organization_id or entry.organization_id == organization_id
    ]


def answer(query: str, organization_id: Optional[str] = None) -> Dict[str, Any]:
    query = (query or "").strip()
    if not query:
        return _not_sure()

    _ensure_embeddings()

    scoped = _scoped_faq(organization_id)
    if not scoped:
        return _not_sure()

    best_entry: Optional[FaqEntry] = None
    best_score = 0.0

    if _faq_embeddings is not None and _faq_embeddings_for:
        encoder = embeddings.get_encoder()
        if encoder is not None:
            try:
                query_vec = np.asarray(
                    encoder.encode([query], convert_to_numpy=True, normalize_embeddings=True)
                )[0]
                for entry in scoped:
                    if entry.id not in _faq_embeddings_for:
                        continue
                    idx = _faq_embeddings_for.index(entry.id)
                    sim = float(_faq_embeddings[idx] @ query_vec)
                    if sim > best_score:
                        best_score = sim
                        best_entry = entry
            except Exception as error:  # pragma: no cover
                LOGGER.warning("FAQ embedding lookup failed: %s", error)

    if best_entry is None:
        for entry in scoped:
            pool = f"{entry.question} {' '.join(entry.keywords)}"
            score = _token_overlap(query, pool)
            if score > best_score:
                best_score = score
                best_entry = entry

    if best_entry is None or best_score < FAQ_MATCH_THRESHOLD:
        return _not_sure()

    confidence = round(min(0.99, max(best_score, 0.55)), 4)
    return {
        "answer": best_entry.answer,
        "confidence": confidence,
        "faqId": best_entry.id,
        "type": "faq",
    }


def _not_sure() -> Dict[str, Any]:
    return {
        "answer": None,
        "fallback": "I am not sure. Please ask at the Reception desk.",
        "confidence": 0.0,
        "type": "faq",
    }


__all__ = ["answer", "invalidate_cache"]
