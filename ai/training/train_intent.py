"""Fine-tune distilbert-base-multilingual-cased on the intent dataset.

The trainer follows section 3.1 of the design document:

- load ``data/intent_dataset.jsonl`` + ``data/intent_labels.json``
- tokenize with DistilBERT's multilingual tokenizer
- train a sequence-classification head for 3–5 epochs on CPU
- evaluate top-1 accuracy on a held-out 10% split
- save the weights to ``artifacts/intent_model/`` and ``artifacts/intent_labels.json``

Run as ``python -m training.train_intent --epochs 3``.
"""
from __future__ import annotations

import argparse
import json
import logging
import random
from pathlib import Path
from typing import Any, Dict, List

from app.config import (
    ARTIFACTS_DIR,
    DATA_DIR,
    DISTILBERT_BASE,
    INTENT_LABELS_FILE,
    INTENT_MODEL_DIR,
)

LOGGER = logging.getLogger("train-intent")


def load_records(dataset_path: Path) -> List[Dict[str, Any]]:
    return [
        json.loads(line)
        for line in dataset_path.read_text("utf-8").splitlines()
        if line.strip()
    ]


def split_records(records: List[Dict[str, Any]], eval_ratio: float = 0.1):
    random.seed(42)
    random.shuffle(records)
    cut = max(1, int(len(records) * eval_ratio))
    return records[cut:], records[:cut]


def train(
    epochs: int = 3,
    batch_size: int = 16,
    learning_rate: float = 5e-5,
    dataset_path: Path = DATA_DIR / "intent_dataset.jsonl",
    labels_path: Path = DATA_DIR / "intent_labels.json",
    output_dir: Path = INTENT_MODEL_DIR,
) -> Dict[str, Any]:
    import numpy as np
    import torch
    from torch.optim import AdamW
    from torch.utils.data import DataLoader, Dataset
    from transformers import (
        AutoModelForSequenceClassification,
        AutoTokenizer,
        get_linear_schedule_with_warmup,
    )

    if not dataset_path.exists() or not labels_path.exists():
        raise SystemExit(
            "Run `python -m training.generate_dataset` first to create the dataset files."
        )

    records = load_records(dataset_path)
    label_map = json.loads(labels_path.read_text("utf-8"))
    num_labels = len(label_map)
    if num_labels < 2:
        raise SystemExit("At least two destination labels are required to train.")

    train_records, eval_records = split_records(records)
    LOGGER.info(
        "Loaded %d total records (train=%d, eval=%d, labels=%d).",
        len(records),
        len(train_records),
        len(eval_records),
        num_labels,
    )

    tokenizer = AutoTokenizer.from_pretrained(DISTILBERT_BASE)
    model = AutoModelForSequenceClassification.from_pretrained(
        DISTILBERT_BASE, num_labels=num_labels
    )

    class IntentDataset(Dataset):
        def __init__(self, rows):
            self.rows = rows

        def __len__(self):
            return len(self.rows)

        def __getitem__(self, index):
            row = self.rows[index]
            encoded = tokenizer(
                row["text"],
                truncation=True,
                padding="max_length",
                max_length=48,
                return_tensors="pt",
            )
            return {
                "input_ids": encoded["input_ids"].squeeze(0),
                "attention_mask": encoded["attention_mask"].squeeze(0),
                "labels": torch.tensor(int(row["label"]), dtype=torch.long),
            }

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)

    train_loader = DataLoader(IntentDataset(train_records), batch_size=batch_size, shuffle=True)
    eval_loader = DataLoader(IntentDataset(eval_records), batch_size=batch_size)

    optimizer = AdamW(model.parameters(), lr=learning_rate)
    total_steps = max(1, len(train_loader) * epochs)
    scheduler = get_linear_schedule_with_warmup(optimizer, num_warmup_steps=0, num_training_steps=total_steps)

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for batch in train_loader:
            batch = {key: value.to(device) for key, value in batch.items()}
            optimizer.zero_grad()
            outputs = model(**batch)
            outputs.loss.backward()
            optimizer.step()
            scheduler.step()
            total_loss += float(outputs.loss)
        LOGGER.info("Epoch %d/%d | train loss=%.4f", epoch, epochs, total_loss / max(1, len(train_loader)))

    # Evaluation
    model.eval()
    correct = 0
    total = 0
    with torch.no_grad():
        for batch in eval_loader:
            labels = batch.pop("labels").to(device)
            batch = {key: value.to(device) for key, value in batch.items()}
            logits = model(**batch).logits
            predictions = logits.argmax(dim=-1)
            correct += int((predictions == labels).sum())
            total += int(labels.size(0))

    accuracy = correct / total if total else 0.0
    LOGGER.info("Top-1 accuracy on hold-out: %.4f (%d/%d)", accuracy, correct, total)

    target_accuracy = 0.88
    if accuracy < target_accuracy:
        LOGGER.warning(
            "Accuracy %.4f is below the SINARMS design target of %.2f. "
            "Consider more epochs, more node aliases, or running download_kaggle.py "
            "to mix in paraphrase data.",
            accuracy,
            target_accuracy,
        )

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))
    INTENT_LABELS_FILE.write_text(json.dumps(label_map, ensure_ascii=False, indent=2), encoding="utf-8")

    metadata = {
        "accuracy": accuracy,
        "records": len(records),
        "labels": num_labels,
        "epochs": epochs,
        "base_model": DISTILBERT_BASE,
        "target_accuracy": target_accuracy,
    }
    (ARTIFACTS_DIR / "training_report.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return metadata


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--learning-rate", type=float, default=5e-5)
    args = parser.parse_args()

    result = train(
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":  # pragma: no cover
    main()
