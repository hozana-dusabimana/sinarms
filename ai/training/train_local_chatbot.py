"""Train the SINARMS local chatbot model.

This is a *research / demo* artifact — it is not wired into the production
chatbot route, which still uses the deterministic intent classifier + FAQ
matcher (+ optional OpenRouter polish). The goal is to demonstrate that the
data we are collecting can power a self-hosted retrieval chatbot in the future.

Pipeline
--------
1. Read every CSV under ``ai/data/external/*.csv`` plus ``ai/data/conversation_log.csv``.
   Files are normalised to a common ``question, answer, language, source`` schema.
2. Deduplicate, drop empty rows, drop rows where the live log was *not* resolved
   (we only learn from interactions where the bot actually answered).
3. Encode every question with the shared multilingual MiniLM encoder (the same
   model used by the FAQ matcher, so we do not download anything new).
4. Hold out 20% of the rows as a test set. For each test question, ask the
   index for its nearest neighbour and check whether the retrieved answer
   matches the ground truth. Report top-1 / top-3 accuracy.
5. Save artifacts to ``ai/artifacts/local_chatbot/``:
   - ``embeddings.npy`` — (N, D) float32 normalised question embeddings
   - ``corpus.jsonl``   — N rows of ``{question, answer, language, source}``
   - ``meta.json``      — model id, threshold, metrics, timestamp

Run
---

    python -m training.train_local_chatbot
    python -m training.train_local_chatbot --threshold 0.55 --test-fraction 0.2

The script is deterministic given the same input rows (fixed numpy seed).
"""
from __future__ import annotations

import argparse
import csv
import json
import logging
import random
import re
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable, List, Optional

import numpy as np

from app.config import ARTIFACTS_DIR, DATA_DIR, MINILM_MODEL


# Quality filters for the live conversation log. The deterministic chatbot
# logger sets ``resolved=1`` for nav/faq/greeting hits, but greetings carry no
# new training signal (the bootstrap CSV already covers them) and rows where
# the underlying source was ``llm-fallback`` are LLM-generated text, not
# verified answers. Excluding both keeps the corpus signal-rich.
LIVE_LOG_EXCLUDED_TYPES = {"greeting"}
LIVE_LOG_EXCLUDED_SOURCES = {"llm-fallback"}

# PII redaction patterns applied to live-log questions before training. We do
# not redact answers (they come from our own templates / FAQ / LLM polish and
# are already vetted to not contain PII).
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_DIGIT_RUN_RE = re.compile(r"\b\d{7,}\b")
_PHONE_RE = re.compile(r"\+?\d[\d\s().-]{6,}\d")

LOGGER = logging.getLogger("train-local-chatbot")

EXTERNAL_DIR = DATA_DIR / "external"
LIVE_LOG = DATA_DIR / "conversation_log.csv"
OUTPUT_DIR = ARTIFACTS_DIR / "local_chatbot"


@dataclass
class QaRow:
    question: str
    answer: str
    language: str
    source: str


def _read_external_csv(path: Path) -> List[QaRow]:
    rows: List[QaRow] = []
    try:
        with path.open("r", encoding="utf-8", errors="ignore", newline="") as handle:
            reader = csv.DictReader(handle)
            cols = {c.lower(): c for c in (reader.fieldnames or [])}
            q_key = next((cols[c] for c in ("question", "context", "input", "prompt") if c in cols), None)
            a_key = next((cols[c] for c in ("answer", "response", "output", "completion") if c in cols), None)
            if not q_key or not a_key:
                LOGGER.warning("Skipping %s: no question/answer columns (got %s)", path.name, list(cols))
                return rows
            lang_key = cols.get("language")
            source_key = cols.get("source")
            for row in reader:
                q = (row.get(q_key) or "").strip()
                a = (row.get(a_key) or "").strip()
                if not q or not a:
                    continue
                rows.append(
                    QaRow(
                        question=q,
                        answer=a,
                        language=(row.get(lang_key) or "en").strip() if lang_key else "en",
                        source=(row.get(source_key) or path.stem).strip() if source_key else path.stem,
                    )
                )
    except Exception as error:
        LOGGER.warning("Failed to read %s: %s", path, error)
    return rows


def _redact_pii(text: str) -> str:
    redacted = _EMAIL_RE.sub("[email]", text)
    redacted = _PHONE_RE.sub("[phone]", redacted)
    redacted = _DIGIT_RUN_RE.sub("[number]", redacted)
    return redacted


def _read_live_log(path: Path, max_age_days: Optional[int]) -> tuple[List[QaRow], dict]:
    """Read the live conversation log with quality filters.

    Returns the kept rows plus a dict of drop counts so the trainer can report
    why rows were excluded. Rows are dropped when:

    - ``resolved != "1"`` — the bot didn't actually answer.
    - ``type`` is in ``LIVE_LOG_EXCLUDED_TYPES`` — already covered by bootstrap.
    - ``source`` is in ``LIVE_LOG_EXCLUDED_SOURCES`` — LLM-generated text, not
      a vetted answer (would create a feedback loop).
    - ``timestamp`` is older than ``max_age_days`` — stale, may reference a
      facility that has since changed.

    Surviving rows get email / phone / long-digit runs redacted from the
    question text before they enter the training corpus.
    """
    rows: List[QaRow] = []
    drops = {"unresolved": 0, "excluded_type": 0, "excluded_source": 0, "stale": 0, "empty": 0}
    if not path.exists():
        return rows, drops

    cutoff = (
        datetime.now(timezone.utc) - timedelta(days=max_age_days)
        if max_age_days and max_age_days > 0 else None
    )

    try:
        with path.open("r", encoding="utf-8", errors="ignore", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                if row.get("resolved") != "1":
                    drops["unresolved"] += 1
                    continue
                if (row.get("type") or "").strip() in LIVE_LOG_EXCLUDED_TYPES:
                    drops["excluded_type"] += 1
                    continue
                if (row.get("source") or "").strip() in LIVE_LOG_EXCLUDED_SOURCES:
                    drops["excluded_source"] += 1
                    continue
                if cutoff is not None:
                    ts = (row.get("timestamp") or "").strip()
                    try:
                        parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                        if parsed.tzinfo is None:
                            parsed = parsed.replace(tzinfo=timezone.utc)
                        if parsed < cutoff:
                            drops["stale"] += 1
                            continue
                    except ValueError:
                        pass

                q = _redact_pii((row.get("query") or "").strip())
                a = (row.get("answer") or "").strip()
                if not q or not a:
                    drops["empty"] += 1
                    continue
                rows.append(
                    QaRow(
                        question=q,
                        answer=a,
                        language=(row.get("language") or "en").strip() or "en",
                        source=f"live:{(row.get('source') or 'unknown').strip()}",
                    )
                )
    except Exception as error:
        LOGGER.warning("Failed to read live log: %s", error)
    return rows, drops


def _dedupe(rows: Iterable[QaRow]) -> List[QaRow]:
    seen: set[tuple[str, str]] = set()
    deduped: List[QaRow] = []
    for row in rows:
        key = (row.question.lower(), row.answer.lower())
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped


def _split(rows: List[QaRow], test_fraction: float, seed: int = 7) -> tuple[List[QaRow], List[QaRow]]:
    """Stratified split by answer string.

    Every unique answer keeps at least one example in the train set so each
    "topic" has an anchor to retrieve. The remaining rows are randomly
    distributed up to ``test_fraction``.
    """
    if test_fraction <= 0 or len(rows) < 10:
        return rows, []

    rng = random.Random(seed)
    by_answer: dict[str, List[int]] = {}
    for i, row in enumerate(rows):
        by_answer.setdefault(row.answer, []).append(i)

    train_idx: set[int] = set()
    pool: List[int] = []
    for answer, group in by_answer.items():
        rng.shuffle(group)
        train_idx.add(group[0])           # one anchor per answer
        pool.extend(group[1:])

    target_test = max(1, int(round(len(rows) * test_fraction)))
    rng.shuffle(pool)
    test_idx = set(pool[:target_test])
    for i in pool[target_test:]:
        train_idx.add(i)

    train = [rows[i] for i in range(len(rows)) if i in train_idx]
    test = [rows[i] for i in range(len(rows)) if i in test_idx]
    return train, test


def _encode(encoder, texts: List[str]) -> np.ndarray:
    vectors = encoder.encode(
        texts,
        convert_to_numpy=True,
        normalize_embeddings=True,
        show_progress_bar=False,
        batch_size=32,
    )
    return np.asarray(vectors, dtype=np.float32)


def _topk_indices(query_vec: np.ndarray, matrix: np.ndarray, k: int) -> List[int]:
    sims = matrix @ query_vec
    if k >= len(sims):
        order = np.argsort(-sims)
    else:
        order = np.argpartition(-sims, k)[:k]
        order = order[np.argsort(-sims[order])]
    return order.tolist()


def _evaluate(
    train_rows: List[QaRow],
    train_matrix: np.ndarray,
    test_rows: List[QaRow],
    test_matrix: np.ndarray,
    threshold: float,
    encoder,
) -> dict:
    if not test_rows:
        return {"test_size": 0}

    top1, top3, above_threshold, correct_above_threshold = 0, 0, 0, 0
    sims_at_top1: List[float] = []
    answer_sims: List[float] = []

    # Pre-encode unique answers for the semantic-equivalence metric. This lets
    # us count "the retrieved answer means the same thing as the gold answer"
    # rather than requiring an exact string match (which is too strict on Q&A
    # data scraped from Kaggle, where every answer string is unique).
    unique_answers = sorted({r.answer for r in train_rows} | {r.answer for r in test_rows})
    answer_vecs = np.asarray(
        encoder.encode(unique_answers, convert_to_numpy=True, normalize_embeddings=True),
        dtype=np.float32,
    )
    answer_index = {a: i for i, a in enumerate(unique_answers)}

    for i, row in enumerate(test_rows):
        idx_list = _topk_indices(test_matrix[i], train_matrix, k=3)
        top_answers = [train_rows[j].answer for j in idx_list]
        top1_sim = float(train_matrix[idx_list[0]] @ test_matrix[i])
        sims_at_top1.append(top1_sim)

        gold_vec = answer_vecs[answer_index[row.answer]]
        retrieved_vec = answer_vecs[answer_index[top_answers[0]]]
        answer_sims.append(float(gold_vec @ retrieved_vec))

        if row.answer == top_answers[0]:
            top1 += 1
        if row.answer in top_answers:
            top3 += 1
        if top1_sim >= threshold:
            above_threshold += 1
            if row.answer == top_answers[0]:
                correct_above_threshold += 1

    n = len(test_rows)
    return {
        "test_size": n,
        "top1_accuracy": round(top1 / n, 4),
        "top3_accuracy": round(top3 / n, 4),
        "mean_top1_similarity": round(float(np.mean(sims_at_top1)), 4),
        "mean_answer_similarity": round(float(np.mean(answer_sims)), 4),
        "answer_match_at_0_85": round(float(np.mean(np.asarray(answer_sims) >= 0.85)), 4),
        "fraction_above_threshold": round(above_threshold / n, 4),
        "precision_above_threshold": (
            round(correct_above_threshold / above_threshold, 4) if above_threshold else 0.0
        ),
    }


def main(argv: Optional[List[str]] = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    parser = argparse.ArgumentParser()
    parser.add_argument("--threshold", type=float, default=0.55,
                        help="Cosine similarity below which inference returns 'not sure'.")
    parser.add_argument("--test-fraction", type=float, default=0.2)
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--model", type=str, default=MINILM_MODEL)
    parser.add_argument(
        "--max-age-days",
        type=int,
        default=180,
        help="Drop live-log rows older than this many days (0 disables). "
             "Prevents stale answers about moved offices from being served.",
    )
    parser.add_argument(
        "--regression-tolerance",
        type=float,
        default=0.05,
        help="Warn if top-1 accuracy drops more than this vs the previous run.",
    )
    args = parser.parse_args(argv)

    np.random.seed(7)

    LOGGER.info("Reading external Q&A CSVs from %s", EXTERNAL_DIR)
    external_rows: List[QaRow] = []
    for csv_path in sorted(EXTERNAL_DIR.glob("*.csv")):
        loaded = _read_external_csv(csv_path)
        LOGGER.info("  %s: %d rows", csv_path.name, len(loaded))
        external_rows.extend(loaded)

    LOGGER.info("Reading live conversation log from %s", LIVE_LOG)
    live_rows, live_drops = _read_live_log(LIVE_LOG, args.max_age_days)
    LOGGER.info("  %d resolved rows kept from live log (drops: %s)", len(live_rows), live_drops)

    rows = _dedupe(external_rows + live_rows)
    LOGGER.info("Total deduplicated rows: %d", len(rows))
    if not rows:
        raise SystemExit("No training rows available — populate ai/data/external/*.csv first.")

    train_rows, test_rows = _split(rows, args.test_fraction)
    LOGGER.info("Train rows: %d, test rows: %d", len(train_rows), len(test_rows))

    LOGGER.info("Loading sentence encoder (%s) — first run will download weights", args.model)
    from sentence_transformers import SentenceTransformer  # noqa: WPS433
    encoder = SentenceTransformer(args.model)

    t0 = time.time()
    train_matrix = _encode(encoder, [r.question for r in train_rows])
    test_matrix = _encode(encoder, [r.question for r in test_rows]) if test_rows else np.zeros((0, train_matrix.shape[1]))
    encode_seconds = time.time() - t0

    metrics = _evaluate(train_rows, train_matrix, test_rows, test_matrix, args.threshold, encoder)
    LOGGER.info("Evaluation: %s", metrics)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    np.save(args.output_dir / "embeddings.npy", train_matrix)

    with (args.output_dir / "corpus.jsonl").open("w", encoding="utf-8") as handle:
        for row in train_rows:
            handle.write(json.dumps(asdict(row), ensure_ascii=False) + "\n")

    meta = {
        "model": args.model,
        "embedding_dim": int(train_matrix.shape[1]),
        "train_size": len(train_rows),
        "test_size": len(test_rows),
        "threshold": args.threshold,
        "max_age_days": args.max_age_days,
        "metrics": metrics,
        "encode_seconds": round(encode_seconds, 2),
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "sources": {
            "external_files": [p.name for p in sorted(EXTERNAL_DIR.glob("*.csv"))],
            "live_log_rows": len(live_rows),
            "live_log_drops": live_drops,
        },
    }
    with (args.output_dir / "meta.json").open("w", encoding="utf-8") as handle:
        json.dump(meta, handle, indent=2, ensure_ascii=False)

    _append_metrics_history(args.output_dir, meta, args.regression_tolerance)

    LOGGER.info("Saved artifacts to %s", args.output_dir)
    print(json.dumps(meta, indent=2, ensure_ascii=False))


def _append_metrics_history(output_dir: Path, meta: dict, tolerance: float) -> None:
    """Append the run's metrics to a history file and warn on regression.

    The history file is JSONL (one row per training run). On each run we
    compare the current top-1 accuracy to the previous run's top-1 and emit
    a WARNING if it dropped by more than ``tolerance``. The warning is
    advisory — it does not fail the run, because in legitimate cases (e.g.
    new tougher test rows added) accuracy can drop temporarily.
    """
    history_path = output_dir / "metrics_history.jsonl"
    previous_top1: Optional[float] = None
    if history_path.exists():
        try:
            with history_path.open("r", encoding="utf-8") as handle:
                last_line = ""
                for line in handle:
                    if line.strip():
                        last_line = line
                if last_line:
                    previous_top1 = (
                        json.loads(last_line).get("metrics", {}).get("top1_accuracy")
                    )
        except Exception as error:  # pragma: no cover
            LOGGER.warning("Could not read metrics history: %s", error)

    record = {
        "trained_at": meta["trained_at"],
        "train_size": meta["train_size"],
        "test_size": meta["test_size"],
        "metrics": meta["metrics"],
    }
    try:
        with history_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    except Exception as error:  # pragma: no cover
        LOGGER.warning("Could not append to metrics history: %s", error)
        return

    current_top1 = meta["metrics"].get("top1_accuracy")
    if previous_top1 is not None and current_top1 is not None:
        delta = current_top1 - previous_top1
        if delta < -tolerance:
            LOGGER.warning(
                "REGRESSION: top1_accuracy dropped from %.4f to %.4f (delta %.4f, tolerance %.2f). "
                "Inspect ai/data/conversation_log.csv for noisy rows.",
                previous_top1, current_top1, delta, tolerance,
            )
        else:
            LOGGER.info(
                "Regression check ok: top1 %.4f -> %.4f (delta %+.4f)",
                previous_top1, current_top1, delta,
            )


if __name__ == "__main__":  # pragma: no cover
    main()
