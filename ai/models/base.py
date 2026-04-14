"""Shared conventions for SINARMS ML model modules.

Every model module under ``models/`` is expected to expose:

- a public inference function (``classify``, ``answer`` …) returning a JSON-
  serialisable dict consumed by the FastAPI layer;
- ``invalidate_cache()`` to drop any derived state (embeddings, alias caches)
  after the Node.js backend pushes a new map or FAQ snapshot;
- optionally ``models_loaded()`` returning a ``{name: bool}`` map used by
  ``/healthz`` to surface which weights are in memory.

The ``ModelProtocol`` below is informational — models are module-level
singletons rather than instances so FastAPI workers share one copy of the
weights without pickling between processes.
"""
from __future__ import annotations

from typing import Any, Dict, Protocol, runtime_checkable


@runtime_checkable
class ModelProtocol(Protocol):
    """Protocol implemented by each model module in this package."""

    def invalidate_cache(self) -> None:
        ...

    def models_loaded(self) -> Dict[str, bool]:  # pragma: no cover - optional
        ...


def empty_result(message: str) -> Dict[str, Any]:
    """Canonical "nothing to return" response shared by classifiers."""
    return {
        "status": "retry",
        "confidence": 0.0,
        "destinationNodeId": None,
        "alternatives": [],
        "message": message,
    }


__all__ = ["ModelProtocol", "empty_result"]
