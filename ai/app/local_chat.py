"""Inference for the locally-trained retrieval chatbot.

Loads the artifacts produced by ``training.train_local_chatbot`` and answers
queries by nearest-neighbour lookup against the embedded corpus. NOT wired
into the production chatbot route — the production path is still the
deterministic intent classifier + FAQ matcher with optional OpenRouter polish.

Usage:
    from app.local_chat import LocalChatbot
    bot = LocalChatbot.load()
    result = bot.answer("Where is the toilet?")
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from app.config import ARTIFACTS_DIR

LOGGER = logging.getLogger(__name__)

DEFAULT_DIR = ARTIFACTS_DIR / "local_chatbot"


@dataclass
class CorpusRow:
    question: str
    answer: str
    language: str
    source: str


class LocalChatbot:
    def __init__(self, embeddings: np.ndarray, corpus: List[CorpusRow], meta: Dict[str, Any], encoder):
        self.embeddings = embeddings
        self.corpus = corpus
        self.meta = meta
        self.encoder = encoder
        self.threshold = float(meta.get("threshold", 0.55))

    @classmethod
    def load(cls, artifact_dir: Path = DEFAULT_DIR) -> "LocalChatbot":
        if not artifact_dir.exists():
            raise FileNotFoundError(
                f"No trained local chatbot at {artifact_dir}. "
                "Run: python -m training.train_local_chatbot"
            )

        embeddings = np.load(artifact_dir / "embeddings.npy")
        meta = json.loads((artifact_dir / "meta.json").read_text(encoding="utf-8"))

        corpus: List[CorpusRow] = []
        with (artifact_dir / "corpus.jsonl").open("r", encoding="utf-8") as handle:
            for line in handle:
                row = json.loads(line)
                corpus.append(CorpusRow(**row))

        from sentence_transformers import SentenceTransformer  # noqa: WPS433
        encoder = SentenceTransformer(meta["model"])

        LOGGER.info(
            "Loaded local chatbot: %d rows, dim=%d, model=%s",
            len(corpus), embeddings.shape[1], meta["model"],
        )
        return cls(embeddings, corpus, meta, encoder)

    def answer(self, query: str, k: int = 3) -> Dict[str, Any]:
        text = (query or "").strip()
        if not text:
            return self._not_sure()

        vec = self.encoder.encode([text], convert_to_numpy=True, normalize_embeddings=True)[0]
        sims = self.embeddings @ vec
        order = np.argsort(-sims)[: max(1, k)]

        top = [
            {
                "question": self.corpus[int(i)].question,
                "answer": self.corpus[int(i)].answer,
                "language": self.corpus[int(i)].language,
                "source": self.corpus[int(i)].source,
                "similarity": round(float(sims[int(i)]), 4),
            }
            for i in order
        ]
        best = top[0]

        if best["similarity"] < self.threshold:
            result = self._not_sure()
            result["alternatives"] = top
            return result

        return {
            "answer": best["answer"],
            "confidence": best["similarity"],
            "matched_question": best["question"],
            "language": best["language"],
            "source": best["source"],
            "type": "local-chat",
            "alternatives": top,
        }

    def _not_sure(self) -> Dict[str, Any]:
        return {
            "answer": "I am not sure. Please ask at the Reception desk.",
            "confidence": 0.0,
            "type": "local-chat",
            "matched_question": None,
            "alternatives": [],
        }


_singleton: Optional[LocalChatbot] = None


def get_local_chatbot(artifact_dir: Path = DEFAULT_DIR) -> Optional[LocalChatbot]:
    """Return a process-wide singleton, or None if no artifact has been trained."""
    global _singleton
    if _singleton is not None:
        return _singleton
    try:
        _singleton = LocalChatbot.load(artifact_dir)
    except FileNotFoundError:
        return None
    except Exception as error:  # pragma: no cover
        LOGGER.warning("Failed to load local chatbot: %s", error)
        return None
    return _singleton
