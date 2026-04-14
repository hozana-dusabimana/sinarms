"""Model 1 — Intent / Destination Classifier.

Two code paths:

1. **Fine-tuned DistilBERT** — if ``artifacts/intent_model/`` exists we load the
   saved sequence-classification head and use it for inference. This is the
   production path described in the SINARMS design document.

2. **Zero-shot multilingual embeddings** — if no fine-tuned model is present,
   fall back to semantic similarity against the node labels and aliases using
   the shared MiniLM encoder (see ``models.embeddings``). This keeps the
   service functional from first run.

If neither path can load (e.g. CI without internet) a dictionary token-overlap
score is used so the endpoint always returns something useful.

Both paths expose the same ``classify(text, location_id)`` surface that the
FastAPI layer calls.
"""
from __future__ import annotations

import json
import logging
import re
import threading
from typing import Any, Dict, List, Optional

import numpy as np

from app.config import (
    CONFIDENCE_CONFIRM,
    CONFIDENCE_RESOLVE,
    INTENT_LABELS_FILE,
    INTENT_MODEL_DIR,
)
from app.state import MapGraph, state

from . import embeddings

LOGGER = logging.getLogger(__name__)

_fine_tuned_lock = threading.Lock()

# Fine-tuned DistilBERT state -------------------------------------------------
_ft_tokenizer = None
_ft_model = None
_ft_label_map: Dict[int, str] = {}
_ft_loaded = False

# Alias cache (node aliases → embeddings) -------------------------------------
_alias_cache: Dict[str, Dict[str, Any]] = {}


def _load_fine_tuned() -> bool:
    global _ft_tokenizer, _ft_model, _ft_label_map, _ft_loaded

    with _fine_tuned_lock:
        if _ft_loaded:
            return _ft_model is not None

        _ft_loaded = True

        if not INTENT_MODEL_DIR.exists() or not INTENT_LABELS_FILE.exists():
            return False

        try:
            from transformers import (  # noqa: WPS433 - heavy import inside guard
                AutoModelForSequenceClassification,
                AutoTokenizer,
            )

            _ft_tokenizer = AutoTokenizer.from_pretrained(str(INTENT_MODEL_DIR))
            _ft_model = AutoModelForSequenceClassification.from_pretrained(
                str(INTENT_MODEL_DIR)
            )
            _ft_model.eval()
            labels = json.loads(INTENT_LABELS_FILE.read_text("utf-8"))
            _ft_label_map = {int(index): str(node_id) for index, node_id in labels.items()}
            LOGGER.info(
                "Loaded fine-tuned DistilBERT with %d classes.", len(_ft_label_map)
            )
            return True
        except Exception as error:  # pragma: no cover
            LOGGER.warning("Fine-tuned model unavailable (%s). Falling back to embeddings.", error)
            _ft_tokenizer = None
            _ft_model = None
            return False


_WORD_RE = re.compile(r"[a-z0-9]+", re.IGNORECASE)


def _tokenize(text: str) -> List[str]:
    return [token.lower() for token in _WORD_RE.findall(text or "")]


def _keyword_fallback_score(text: str, alias: str) -> float:
    """Dictionary-style overlap score used when no ML model is loadable at all."""
    text_tokens = set(_tokenize(text))
    alias_tokens = set(_tokenize(alias))
    if not text_tokens or not alias_tokens:
        return 0.0

    if alias.lower() in text.lower():
        return min(0.95, 0.7 + len(alias) / 120.0)

    overlap = text_tokens & alias_tokens
    if not overlap:
        return 0.0
    return min(0.9, len(overlap) / len(alias_tokens) * 0.8)


def _candidate_nodes(map_graph: MapGraph) -> List[Dict[str, Any]]:
    return [
        node
        for node in map_graph.nodes
        if node.get("type") not in {"exit", "checkpoint", "floorplan"}
    ]


def _node_ids_hash(map_graph: MapGraph) -> str:
    ids = sorted(node["id"] for node in map_graph.nodes)
    return ",".join(ids)


def _build_alias_cache(map_graph: MapGraph) -> Dict[str, Any]:
    cache_key = map_graph.location_id
    cache = _alias_cache.get(cache_key)
    if cache and cache.get("node_ids_hash") == _node_ids_hash(map_graph):
        return cache

    nodes = _candidate_nodes(map_graph)
    phrases: List[str] = []
    phrase_to_node: List[str] = []
    for node in nodes:
        aliases = [node.get("label") or ""] + list(node.get("aliases", []))
        aliases = [alias for alias in aliases if alias]
        for alias in aliases:
            phrases.append(alias)
            phrase_to_node.append(node["id"])

    encoded = None
    encoder = embeddings.get_encoder()
    if encoder is not None and phrases:
        try:
            encoded = np.asarray(
                encoder.encode(phrases, convert_to_numpy=True, normalize_embeddings=True)
            )
        except Exception as error:  # pragma: no cover
            LOGGER.warning("Failed to encode aliases: %s", error)
            encoded = None

    cache = {
        "phrases": phrases,
        "phrase_to_node": phrase_to_node,
        "embeddings": encoded,
        "node_ids_hash": _node_ids_hash(map_graph),
        "node_labels": {node["id"]: node.get("label", node["id"]) for node in nodes},
    }
    _alias_cache[cache_key] = cache
    return cache


def invalidate_cache() -> None:
    _alias_cache.clear()


def _result(
    status: str,
    confidence: float,
    destination_node_id: Optional[str],
    alternatives: List[Dict[str, Any]],
    message: str,
) -> Dict[str, Any]:
    return {
        "status": status,
        "confidence": round(float(confidence), 4),
        "destinationNodeId": destination_node_id,
        "alternatives": alternatives,
        "message": message,
    }


def _wrap_scores(scored: List[Dict[str, Any]], map_graph: MapGraph) -> Dict[str, Any]:
    if not scored:
        return _result(
            status="retry",
            confidence=0.0,
            destination_node_id=None,
            alternatives=[],
            message="We could not find that destination. Please describe it differently or ask at the Reception desk.",
        )

    top = scored[0]
    second = scored[1] if len(scored) > 1 else None

    if top["confidence"] < CONFIDENCE_CONFIRM:
        return _result(
            status="retry",
            confidence=top["confidence"],
            destination_node_id=None,
            alternatives=scored[:2],
            message="We could not find that destination. Please describe it differently or ask at the Reception desk.",
        )

    needs_confirm = top["confidence"] < CONFIDENCE_RESOLVE or (
        second and abs(top["confidence"] - second["confidence"]) < 0.12
    )
    if needs_confirm:
        return _result(
            status="confirm",
            confidence=top["confidence"],
            destination_node_id=None,
            alternatives=scored[:2],
            message="Did you mean one of these destinations?",
        )

    return _result(
        status="resolved",
        confidence=top["confidence"],
        destination_node_id=top["nodeId"],
        alternatives=scored[1:3] if second else [],
        message="Destination recognized.",
    )


def _classify_with_fine_tuned(text: str, map_graph: MapGraph) -> Optional[Dict[str, Any]]:
    if _ft_model is None or _ft_tokenizer is None or not _ft_label_map:
        return None

    import torch  # noqa: WPS433

    inputs = _ft_tokenizer(
        text,
        truncation=True,
        padding=True,
        return_tensors="pt",
        max_length=64,
    )
    with torch.no_grad():
        logits = _ft_model(**inputs).logits[0]
        probs = torch.softmax(logits, dim=-1).cpu().numpy()

    node_ids_in_graph = {node["id"] for node in map_graph.nodes}
    scored: List[Dict[str, Any]] = []
    labels_map = _build_alias_cache(map_graph)["node_labels"]
    for index, prob in enumerate(probs):
        node_id = _ft_label_map.get(int(index))
        if not node_id or node_id not in node_ids_in_graph:
            continue
        scored.append(
            {
                "nodeId": node_id,
                "label": labels_map.get(node_id, node_id),
                "confidence": float(prob),
            }
        )
    scored.sort(key=lambda entry: entry["confidence"], reverse=True)
    return _wrap_scores(scored[:5], map_graph)


def _classify_with_embeddings(text: str, map_graph: MapGraph) -> Dict[str, Any]:
    cache = _build_alias_cache(map_graph)
    phrases = cache["phrases"]
    phrase_to_node = cache["phrase_to_node"]
    encoded = cache["embeddings"]

    scores: Dict[str, float] = {}

    if encoded is not None and phrases:
        encoder = embeddings.get_encoder()
        if encoder is not None:
            query_vec = np.asarray(
                encoder.encode([text], convert_to_numpy=True, normalize_embeddings=True)
            )[0]
            sims = encoded @ query_vec
            for sim, node_id in zip(sims, phrase_to_node):
                prev = scores.get(node_id, 0.0)
                score = float((sim + 1.0) / 2.0)  # map cosine [-1,1] → [0,1]
                if score > prev:
                    scores[node_id] = score

    if not scores:
        # Dictionary fallback — guarantees the service is useful even without any ML
        for phrase, node_id in zip(phrases, phrase_to_node):
            score = _keyword_fallback_score(text, phrase)
            if score > scores.get(node_id, 0.0):
                scores[node_id] = score

    labels_map = cache["node_labels"]
    scored = [
        {"nodeId": node_id, "label": labels_map.get(node_id, node_id), "confidence": round(score, 4)}
        for node_id, score in scores.items()
        if score > 0
    ]
    scored.sort(key=lambda entry: entry["confidence"], reverse=True)
    return _wrap_scores(scored[:5], map_graph)


def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        curr = [i] + [0] * len(b)
        for j, cb in enumerate(b, start=1):
            cost = 0 if ca == cb else 1
            curr[j] = min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
        prev = curr
    return prev[-1]


def _fuzzy_token_match(query_tokens: List[str], alias_tokens: List[str]) -> float:
    """Score an alias against the query using token-level fuzzy matches.
    Returns a score in [0, 1]: 1.0 for an exact full-alias hit, lower for
    partial / typo'd matches. Returns 0 if no meaningful overlap.
    """
    if not query_tokens or not alias_tokens:
        return 0.0
    matched = 0
    for atok in alias_tokens:
        if len(atok) < 3:
            continue
        best = None
        for qtok in query_tokens:
            if qtok == atok:
                dist = 0
            elif len(qtok) < 3:
                continue
            else:
                dist = _levenshtein(qtok, atok)
            # allow up to 1 typo for short words, 2 for longer ones
            threshold = 1 if len(atok) <= 5 else 2
            if dist <= threshold:
                if best is None or dist < best:
                    best = dist
        if best is not None:
            matched += 1
    if matched == 0:
        return 0.0
    return matched / len([t for t in alias_tokens if len(t) >= 3])


def _literal_alias_match(text: str, map_graph: MapGraph) -> Optional[Dict[str, Any]]:
    """Short-circuit: if the query literally (or near-literally) contains a
    node label or alias, treat that as a confident hit. Prevents a stale
    fine-tuned classifier from hallucinating alternatives when the user said
    the destination name outright, and tolerates small typos via Levenshtein.
    """
    haystack = f" {text.lower()} "
    query_tokens = _tokenize(text)
    exact_best = None
    exact_best_len = 0
    fuzzy_best = None
    fuzzy_best_score = 0.0

    for node in _candidate_nodes(map_graph):
        label = node.get("label") or ""
        candidates = [label] + list(node.get("aliases") or [])
        for alias in candidates:
            if not alias:
                continue
            alias_norm = alias.lower().strip()
            if len(alias_norm) < 3:
                continue
            # Exact substring match (word boundary).
            if (
                f" {alias_norm} " in haystack
                or haystack.startswith(f" {alias_norm}")
                or haystack.endswith(f"{alias_norm} ")
            ):
                if len(alias_norm) > exact_best_len:
                    exact_best_len = len(alias_norm)
                    exact_best = node
                continue
            # Fuzzy token-level match — catches typos like "receiption".
            alias_tokens = _tokenize(alias_norm)
            score = _fuzzy_token_match(query_tokens, alias_tokens)
            if score > fuzzy_best_score:
                fuzzy_best_score = score
                fuzzy_best = node

    if exact_best is not None:
        return _result(
            status="resolved",
            confidence=0.95,
            destination_node_id=exact_best["id"],
            alternatives=[],
            message="Destination recognized.",
        )
    # Require a strong fuzzy match (alias fully covered by typo-tolerant tokens).
    if fuzzy_best is not None and fuzzy_best_score >= 0.75:
        return _result(
            status="resolved",
            confidence=0.85,
            destination_node_id=fuzzy_best["id"],
            alternatives=[],
            message="Destination recognized (approximate).",
        )
    return None


def classify(text: str, location_id: Optional[str] = None) -> Dict[str, Any]:
    text = (text or "").strip()
    if not text:
        return _result(
            status="retry",
            confidence=0.0,
            destination_node_id=None,
            alternatives=[],
            message="Please type the office or person you are visiting.",
        )

    map_graph = state.get_map(location_id) if location_id else state.default_map()
    if map_graph is None:
        return _result(
            status="retry",
            confidence=0.0,
            destination_node_id=None,
            alternatives=[],
            message="No facility map is loaded. Ask the front desk for help.",
        )

    literal = _literal_alias_match(text, map_graph)
    if literal:
        return literal

    if _load_fine_tuned():
        result = _classify_with_fine_tuned(text, map_graph)
        if result and result["status"] in {"resolved", "confirm"}:
            return result

    return _classify_with_embeddings(text, map_graph)


def classify_across_locations(text: str) -> Dict[str, Any]:
    """Search every loaded facility map for the best destination match.

    Returns a payload shaped like ``classify`` but with two extra fields:
    ``locationId`` and ``locationName`` identifying which location owns the
    winning match. Used by the chatbot when the visitor's current location
    has no strong match — the destination may live in a different building.
    """
    text = (text or "").strip()
    if not text:
        return _result(
            status="retry",
            confidence=0.0,
            destination_node_id=None,
            alternatives=[],
            message="Please type the office or person you are visiting.",
        )

    best: Optional[Dict[str, Any]] = None
    for location_id, map_graph in state.maps.items():
        per_map = _classify_with_embeddings(text, map_graph)
        top_conf = float(per_map.get("confidence") or 0.0)
        if best is None or top_conf > float(best.get("confidence") or 0.0):
            enriched = dict(per_map)
            enriched["locationId"] = location_id
            best = enriched

    if best is None:
        return _result(
            status="retry",
            confidence=0.0,
            destination_node_id=None,
            alternatives=[],
            message="We could not find that destination in any location.",
        )
    return best


def models_loaded() -> Dict[str, bool]:
    return {
        "fine_tuned_distilbert": _ft_model is not None,
        "embedding_model": embeddings.is_loaded(),
    }


__all__ = [
    "classify",
    "classify_across_locations",
    "invalidate_cache",
    "models_loaded",
]
