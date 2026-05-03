"""Interactive REPL for the locally-trained chatbot.

Run after ``train_local_chatbot`` has produced artifacts:

    python -m training.chat_repl

Each line you type is sent to the loaded model. The REPL prints the top match,
its similarity score, and the next two alternatives so it is clear *why* the
bot answered the way it did. Type ``:q`` to exit.
"""
from __future__ import annotations

import json
import logging
import sys

from app.local_chat import get_local_chatbot


def main() -> None:
    logging.basicConfig(level=logging.WARNING)
    bot = get_local_chatbot()
    if bot is None:
        sys.stderr.write(
            "No trained local chatbot found.\n"
            "Run: python -m training.train_local_chatbot\n"
        )
        sys.exit(1)

    meta = bot.meta
    print("SINARMS local chatbot REPL")
    print(
        f"  model={meta.get('model')}  rows={meta.get('train_size')}  "
        f"threshold={meta.get('threshold')}  top1={meta.get('metrics', {}).get('top1_accuracy')}"
    )
    print("  type :q to quit, :meta to print full metadata")
    print()

    while True:
        try:
            line = input("you> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not line:
            continue
        if line == ":q":
            break
        if line == ":meta":
            print(json.dumps(meta, indent=2, ensure_ascii=False))
            continue

        result = bot.answer(line, k=3)
        print(f"bot> {result['answer']}  (confidence={result['confidence']})")
        for alt in result.get("alternatives", [])[1:]:
            print(f"     · alt {alt['similarity']:.2f}: {alt['question']!r} -> {alt['answer'][:80]!r}")
        print()


if __name__ == "__main__":  # pragma: no cover
    main()
