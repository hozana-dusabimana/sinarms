"""In-memory state shared across the AI engine.

The engine receives map graphs and FAQ entries from the Node.js backend on
startup and on demand via /ai/refresh-* endpoints. Nothing is persisted here
because Node.js (+MySQL) is the source of truth.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from typing import Any, Dict, List, Optional


@dataclass
class MapGraph:
    location_id: str
    nodes: List[Dict[str, Any]] = field(default_factory=list)
    edges: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class FaqEntry:
    id: str
    organization_id: Optional[str]
    language: str
    question: str
    answer: str
    keywords: List[str] = field(default_factory=list)


class EngineState:
    def __init__(self) -> None:
        self._lock = RLock()
        self.maps: Dict[str, MapGraph] = {}
        self.faq: List[FaqEntry] = []
        self.faq_embeddings = None  # numpy array, computed lazily

    def set_maps(self, raw_maps: Dict[str, Any]) -> None:
        with self._lock:
            self.maps = {
                location_id: MapGraph(
                    location_id=location_id,
                    nodes=list(graph.get("nodes", [])),
                    edges=list(graph.get("edges", [])),
                )
                for location_id, graph in (raw_maps or {}).items()
            }

    def get_map(self, location_id: str) -> Optional[MapGraph]:
        with self._lock:
            return self.maps.get(location_id)

    def default_map(self) -> Optional[MapGraph]:
        with self._lock:
            if not self.maps:
                return None
            return next(iter(self.maps.values()))

    def set_faq(self, raw_faq: List[Dict[str, Any]]) -> None:
        with self._lock:
            self.faq = [
                FaqEntry(
                    id=str(entry.get("id")),
                    organization_id=entry.get("organizationId"),
                    language=entry.get("language", "en"),
                    question=entry.get("question", ""),
                    answer=entry.get("answer", ""),
                    keywords=list(entry.get("keywords", [])),
                )
                for entry in (raw_faq or [])
                if entry.get("answer")
            ]
            self.faq_embeddings = None  # invalidate cache


state = EngineState()
