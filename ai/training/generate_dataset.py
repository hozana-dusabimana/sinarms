"""Generate a multilingual intent dataset from the live facility graph.

Steps:

1. Pull the map graph from the Node.js backend (or from the --seed-file JSON).
2. For every destination node, expand its label + aliases against the English,
   French, and Kinyarwanda templates.
3. Augment each phrase to grow the corpus to the target size.
4. Write ``data/intent_dataset.jsonl`` (one JSON object per line: ``{text, label}``).
5. Save a ``data/intent_labels.json`` mapping of label -> node_id.

Run as ``python -m training.generate_dataset``.
"""
from __future__ import annotations

import argparse
import itertools
import json
import logging
import random
from pathlib import Path
from typing import Any, Dict, List

from app.config import DATA_DIR
from .augment import augment_phrase
from .download_kaggle import iter_paraphrase_pairs
from .templates import TEMPLATES_EN, TEMPLATES_FR, TEMPLATES_RW

LOGGER = logging.getLogger("generate-dataset")


def _iter_destination_nodes(maps: Dict[str, Any]):
    for location_id, graph in maps.items():
        for node in graph.get("nodes", []):
            if node.get("type") in {"exit", "checkpoint", "floorplan"}:
                continue
            yield location_id, node


import re as _re

_NAV_PATTERN = _re.compile(
    r"^\s*(where\s+(is|can\s+i\s+find|are)|how\s+(do|can)\s+i\s+(get|go|reach)|how\s+to\s+(get|reach|find)|can\s+you\s+(tell|show|help).{0,40}\b(find|reach|get|locate)\b)",
    _re.IGNORECASE,
)

_NOUN_TAIL_PATTERN = _re.compile(r"\b(the\s+[a-z ]{2,40}?|a\s+[a-z ]{2,40}?|to\s+[a-z ]{2,40}?)[\?\.]?\s*$", _re.IGNORECASE)


def _filter_nav_paraphrases(paraphrases):
    """Keep only paraphrase pairs whose LEFT question is a navigation-style ask.

    These are the only Quora rows that produce realistic visitor phrasings once
    we splice in a destination alias. Unrelated Q&A pairs (\"What is the
    meaning of life?\") are discarded — they'd only add label noise.
    """
    kept = []
    for left, right in paraphrases:
        if not left or not right:
            continue
        if not _NAV_PATTERN.match(left):
            continue
        if not _NOUN_TAIL_PATTERN.search(left):
            continue
        if len(right) > 120:
            continue
        kept.append((left, right))
        if len(kept) >= 200:
            break
    return kept


def _apply_paraphrases(phrase: str, alias: str, paraphrases) -> List[str]:
    """Splice ``alias`` into the noun slot of nav-style Quora paraphrase pairs.

    Given a filtered pair like
        left  = "Where can I find the best restaurant?"
        right = "How do I locate the best restaurant?"
    we replace the noun tail with ``alias`` to get an extra training phrase:
        "How do I locate the HR Office 104?"
    """
    if not paraphrases:
        return []

    variants: List[str] = []
    for _, right in paraphrases[:30]:
        spliced = _NOUN_TAIL_PATTERN.sub(alias, right, count=1).strip()
        if spliced and spliced.lower() != right.lower() and len(spliced) < 140:
            variants.append(spliced)
        if len(variants) >= 2:
            break
    return variants


def build_dataset(
    maps: Dict[str, Any],
    target_size: int = 5000,
    variants_per_template: int = 2,
    external_dir=None,
) -> Dict[str, Any]:
    records: List[Dict[str, str]] = []
    label_to_node: Dict[int, str] = {}
    node_to_label: Dict[str, int] = {}

    paraphrases = []
    if external_dir is not None:
        try:
            raw_pairs = iter_paraphrase_pairs(external_dir)
            paraphrases = _filter_nav_paraphrases(raw_pairs)
            LOGGER.info(
                "Loaded %d raw paraphrase pairs from Kaggle CSV/TSV; kept %d nav-style pairs.",
                len(raw_pairs),
                len(paraphrases),
            )
        except Exception as error:  # pragma: no cover
            LOGGER.warning("Could not read external paraphrases: %s", error)

    for _, node in _iter_destination_nodes(maps):
        node_id = node["id"]
        if node_id in node_to_label:
            continue
        label_index = len(node_to_label)
        node_to_label[node_id] = label_index
        label_to_node[label_index] = node_id

        aliases = [node.get("label", node_id)] + list(node.get("aliases", []))
        aliases = [alias for alias in aliases if alias]

        for alias, template in itertools.product(
            aliases, TEMPLATES_EN + TEMPLATES_FR + TEMPLATES_RW
        ):
            phrase = template.replace("{destination}", alias)
            for variant in augment_phrase(phrase, variants=variants_per_template):
                records.append({"text": variant, "label": node_to_label[node_id]})
            for paraphrase_variant in _apply_paraphrases(phrase, alias, paraphrases):
                records.append({"text": paraphrase_variant, "label": node_to_label[node_id]})

    random.shuffle(records)
    if len(records) > target_size:
        records = records[:target_size]

    return {
        "records": records,
        "label_to_node": label_to_node,
        "node_to_label": node_to_label,
    }


def write_dataset(dataset: Dict[str, Any], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    out_file = output_dir / "intent_dataset.jsonl"
    with out_file.open("w", encoding="utf-8") as handle:
        for record in dataset["records"]:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    labels_file = output_dir / "intent_labels.json"
    labels_file.write_text(
        json.dumps(dataset["label_to_node"], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    LOGGER.info("Wrote %d records to %s", len(dataset["records"]), out_file)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=None, help="SINARMS backend base URL (overrides env).")
    parser.add_argument("--seed-file", default=None, help="Local JSON file with {maps: {...}}.")
    parser.add_argument("--target-size", type=int, default=6000)
    parser.add_argument("--variants", type=int, default=2)
    parser.add_argument("--output-dir", type=Path, default=DATA_DIR)
    parser.add_argument(
        "--external-dir",
        type=Path,
        default=DATA_DIR / "external",
        help="Directory containing Kaggle/HF paraphrase data (see training.download_kaggle).",
    )
    args = parser.parse_args()

    if args.seed_file:
        payload = json.loads(Path(args.seed_file).read_text("utf-8"))
        maps = payload.get("maps", payload) if isinstance(payload, dict) else {}
    else:
        if args.base_url:
            import os

            os.environ["SINARMS_BACKEND_URL"] = args.base_url
        from app.backend_client import fetch_maps  # lazy: only needs httpx when fetching

        maps = fetch_maps()

    if not maps:
        raise SystemExit("No maps available. Pass --seed-file or run the Node.js backend first.")

    dataset = build_dataset(
        maps,
        target_size=args.target_size,
        variants_per_template=args.variants,
        external_dir=args.external_dir if args.external_dir and args.external_dir.exists() else None,
    )
    write_dataset(dataset, args.output_dir)


if __name__ == "__main__":  # pragma: no cover
    main()
