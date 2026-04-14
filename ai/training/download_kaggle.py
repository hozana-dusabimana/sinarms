"""Download supplementary datasets from Kaggle / HuggingFace.

The SINARMS intent classifier is trained primarily on multilingual templates
filled with the live facility node aliases (see ``generate_dataset.py``). To
improve robustness the dataset is optionally mixed with paraphrases pulled from
Kaggle and Kinyarwanda parallel sentences from HuggingFace.

Defaults used by this script — all real, publicly available resources:

- Kaggle ``mrutyunjaybiswal/quora-question-pairs`` — English question pairs
  (duplicates) used to paraphrase "where/what/how" style questions. Works as a
  drop-in substitute for any multilingual paraphrase corpus. Override with
  ``--kaggle <owner>/<dataset>`` to point at a different Kaggle dataset.
- HuggingFace ``Helsinki-NLP/tatoeba_mt`` (``eng-kin`` config) — the public
  Tatoeba English/Kinyarwanda parallel sentence pairs, used to bootstrap
  Kinyarwanda phrasings.

Both are optional. The primary training data remains the facility-specific
corpus. If Kaggle credentials are missing the script logs a warning and exits
cleanly without failing the training pipeline.

Put your Kaggle API token at ``~/.kaggle/kaggle.json`` and enable the API at
https://www.kaggle.com/settings before running this.
"""
from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import List

from app.config import DATA_DIR

LOGGER = logging.getLogger("download-kaggle")


def download_kaggle(dataset: str, destination: Path) -> bool:
    try:
        from kaggle.api.kaggle_api_extended import KaggleApi  # noqa: WPS433

        api = KaggleApi()
        api.authenticate()
        destination.mkdir(parents=True, exist_ok=True)
        api.dataset_download_files(dataset, path=str(destination), unzip=True)
        LOGGER.info("Downloaded Kaggle dataset %s to %s", dataset, destination)
        return True
    except Exception as error:  # pragma: no cover - depends on network/keys
        LOGGER.warning("Kaggle download skipped (%s): %s", dataset, error)
        return False


def download_huggingface(dataset_name: str, destination: Path, config: str | None = None) -> bool:
    try:
        from datasets import load_dataset  # noqa: WPS433

        ds = load_dataset(dataset_name, config) if config else load_dataset(dataset_name)
        destination.mkdir(parents=True, exist_ok=True)
        suffix = f"__{config}" if config else ""
        out_path = destination / f"{dataset_name.replace('/', '__')}{suffix}.jsonl"
        with out_path.open("w", encoding="utf-8") as handle:
            for split in ds:
                for row in ds[split]:
                    handle.write(json.dumps(row, ensure_ascii=False) + "\n")
        LOGGER.info("Downloaded HuggingFace dataset %s to %s", dataset_name, out_path)
        return True
    except Exception as error:  # pragma: no cover
        LOGGER.warning("HuggingFace download skipped (%s): %s", dataset_name, error)
        return False


def iter_paraphrase_pairs(destination: Path) -> List[tuple[str, str]]:
    """Scan downloaded files and yield (left, right) paraphrase-like pairs.

    Known schemas handled:
    - Quora Question Pairs (``train.csv``: ``question1, question2, is_duplicate``).
    - Any CSV with columns named ``text1``/``text2`` or ``sentence1``/``sentence2``.
    - JSONL with keys ``text``/``paraphrase`` or ``source``/``target``.
    """
    pairs: List[tuple[str, str]] = []
    if not destination.exists():
        return pairs

    tabular_files = list(destination.glob("*.csv")) + list(destination.glob("*.tsv"))
    for csv_file in tabular_files:
        try:
            import csv  # noqa: WPS433

            delimiter = "\t" if csv_file.suffix.lower() == ".tsv" else ","
            with csv_file.open("r", encoding="utf-8", errors="ignore") as handle:
                reader = csv.DictReader(handle, delimiter=delimiter)
                fieldnames = {name.lower(): name for name in (reader.fieldnames or [])}

                candidates = [
                    ("question1", "question2"),
                    ("text1", "text2"),
                    ("sentence1", "sentence2"),
                    ("source", "target"),
                ]
                match = next(
                    (
                        (fieldnames[a], fieldnames[b])
                        for (a, b) in candidates
                        if a in fieldnames and b in fieldnames
                    ),
                    None,
                )
                if not match:
                    continue

                is_duplicate = fieldnames.get("is_duplicate")
                left_col, right_col = match
                for row in reader:
                    if is_duplicate and row.get(is_duplicate) not in ("1", 1, True, "true", "True"):
                        continue
                    left, right = (row.get(left_col) or "").strip(), (row.get(right_col) or "").strip()
                    if left and right and left.lower() != right.lower():
                        pairs.append((left, right))
        except Exception as error:  # pragma: no cover
            LOGGER.warning("Failed to parse %s: %s", csv_file, error)

    for jsonl_file in destination.glob("*.jsonl"):
        try:
            with jsonl_file.open("r", encoding="utf-8") as handle:
                for line in handle:
                    row = json.loads(line)
                    if not isinstance(row, dict):
                        continue
                    for left_key, right_key in (
                        ("text", "paraphrase"),
                        ("source", "target"),
                        ("sentence1", "sentence2"),
                        ("src", "tgt"),
                    ):
                        left = (row.get(left_key) or "").strip() if isinstance(row.get(left_key), str) else ""
                        right = (row.get(right_key) or "").strip() if isinstance(row.get(right_key), str) else ""
                        if left and right and left.lower() != right.lower():
                            pairs.append((left, right))
                            break
                    else:
                        translation = row.get("translation")
                        if isinstance(translation, dict) and len(translation) >= 2:
                            values = [str(v).strip() for v in translation.values() if str(v).strip()]
                            if len(values) >= 2:
                                pairs.append((values[0], values[1]))
        except Exception as error:  # pragma: no cover
            LOGGER.warning("Failed to parse %s: %s", jsonl_file, error)

    return pairs


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--kaggle", action="append", default=[])
    parser.add_argument("--hf", action="append", default=[])
    parser.add_argument("--output-dir", type=Path, default=DATA_DIR / "external")
    args = parser.parse_args()

    targets_k = args.kaggle or ["mrutyunjaybiswal/quora-question-pairs"]
    targets_h = args.hf or ["Helsinki-NLP/tatoeba_mt:eng-kin"]

    ok = False
    for dataset in targets_k:
        ok = download_kaggle(dataset, args.output_dir) or ok
    for dataset in targets_h:
        if ":" in dataset:
            name, config = dataset.split(":", 1)
            ok = download_huggingface(name, args.output_dir, config) or ok
        else:
            ok = download_huggingface(dataset, args.output_dir) or ok

    if not ok:
        LOGGER.info("No external datasets were downloaded; continuing with synthetic data only.")
    else:
        pairs = iter_paraphrase_pairs(args.output_dir)
        LOGGER.info("Parsed %d paraphrase-style pairs from external data.", len(pairs))


if __name__ == "__main__":  # pragma: no cover
    main()
