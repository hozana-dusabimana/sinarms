"""Light-weight text augmentation for the intent dataset.

Only operations that do not require a second ML model:

- synonym replacement from a small curated dictionary;
- random token reordering within short phrases;
- random filler word insertion ("please", "s'il vous plait", "ngwino");
- case / punctuation variation.

These are deliberately simple so the trainer remains reproducible and offline.
"""
from __future__ import annotations

import random
from typing import Iterable, List

from .templates import SYNONYMS

FILLERS = ["please", "thanks", "svp", "ngwino", "murakoze"]


def _synonym_swap(tokens: List[str]) -> List[str]:
    new_tokens: List[str] = []
    for token in tokens:
        stripped = token.lower().strip(",.?!")
        if stripped in SYNONYMS and random.random() < 0.35:
            new_tokens.append(random.choice(SYNONYMS[stripped]))
        else:
            new_tokens.append(token)
    return new_tokens


def _token_reorder(tokens: List[str]) -> List[str]:
    if len(tokens) < 4 or random.random() > 0.2:
        return tokens
    swap_index = random.randint(0, len(tokens) - 2)
    tokens = tokens[:]
    tokens[swap_index], tokens[swap_index + 1] = tokens[swap_index + 1], tokens[swap_index]
    return tokens


def _insert_filler(tokens: List[str]) -> List[str]:
    if random.random() < 0.1:
        return tokens + [random.choice(FILLERS)]
    return tokens


def augment_phrase(phrase: str, variants: int = 2, seed: int | None = None) -> List[str]:
    random.seed(seed) if seed is not None else None
    outputs = {phrase}
    for _ in range(variants):
        tokens = phrase.split()
        tokens = _synonym_swap(tokens)
        tokens = _token_reorder(tokens)
        tokens = _insert_filler(tokens)
        variant = " ".join(tokens).strip()
        if variant:
            outputs.add(variant)
    return list(outputs)


def augment_many(phrases: Iterable[str], variants: int = 2) -> List[str]:
    bag: List[str] = []
    for phrase in phrases:
        bag.extend(augment_phrase(phrase, variants=variants))
    return bag
