"""SINARMS machine-learning models.

Each model module exposes the same minimal surface so ``app/main.py`` can call
them uniformly:

- ``<model>.<predict>(...)`` — inference entry point
- ``<model>.invalidate_cache()`` — clear derived state after the backend
  pushes fresh maps / FAQ

Public exports:

- ``intent_classifier`` — Model 1, destination / intent classifier
- ``faq_matcher``       — Model 2, FAQ retrieval via sentence embeddings
"""
from . import faq_matcher, intent_classifier

__all__ = ["intent_classifier", "faq_matcher"]
