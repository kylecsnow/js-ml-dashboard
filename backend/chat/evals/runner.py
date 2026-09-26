"""Run golden-set cases through the dataset-generator chat graph.

Invokes the graph directly and stubs search_chemistry_sources with
STUB_SOURCES. Loads cases with schema.load_golden_set and scores them
with scorers.score_case.

From backend/ in the ml-dashboard conda env:

    python -m chat.evals.runner
    python -m chat.evals.runner --id info-noise --id edit-rows-only
    python -m chat.evals.runner --tag core
    python -m chat.evals.runner --min-pass-rate 0.7
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from unittest.mock import patch

from dotenv import load_dotenv
from fastapi import HTTPException

from chat.chat_agent import (
    REASONING_EFFORT,
    build_graph,
    chat_api_key_error,
    chat_model,
    chat_provider,
    compact_history,
    strip_unchanged_updates,
)
from chat.chemistry_search import prepare_cited_sources_for_display
from chat.evals import schema, scorers
from chat.form_contracts import ChatReply

_EVALS_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _EVALS_DIR.parents[2]  # repo root, where .env lives
DEFAULT_GOLDEN_SET = _EVALS_DIR / "golden_set.jsonl"
DEFAULT_RESULTS_DIR = _EVALS_DIR / "results"
_RATE_LIMIT_RETRIES = 3
_RATE_LIMIT_WAIT_S = 30.0

STUB_SOURCES = [
    {
        "title": "Eval source 1",
        "url": "https://example.com/eval/source-1",
        "snippet": "Fixed search hit used by evals.",
    },
    {
        "title": "Eval source 2",
        "url": "https://example.com/eval/source-2",
        "snippet": "Fixed search hit used by evals.",
    },
    {
        "title": "Eval source 3",
        "url": "https://example.com/eval/source-3",
        "snippet": "Fixed search hit used by evals.",
    },
]


def _case_get(case: Any, name: str, default: Any = None) -> Any:
    if isinstance(case, dict):
        return case.get(name, default)
    if hasattr(case, name):
        value = getattr(case, name)
        return default if value is None and default is not None else value
    return default


def load_cases(path: Path) -> list[Any]:
    loader = getattr(schema, "load_golden_set", None)
    if callable(loader):
        return list(loader(path))

    cases: list[dict[str, Any]] = []
    for line_no, line in enumerate(path.read_text().splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        try:
            cases.append(json.loads(line))
        except json.JSONDecodeError as exc:
            raise ValueError(f"{path}:{line_no}: invalid JSONL") from exc
    return cases


def score_case(case: Any, result: dict[str, Any]) -> dict[str, float]:
    scorer = getattr(scorers, "score_case", None)
    if not callable(scorer):
        return {}
    return dict(scorer(case, result))


def select_cases(
    cases: list[Any],
    ids: list[str] | None = None,
    tags: list[str] | None = None,
) -> list[Any]:
    selected = list(cases)
    if ids:
        want = set(ids)
        selected = [case for case in selected if _case_get(case, "id") in want]
        found = {_case_get(case, "id") for case in selected}
        missing = want - found
        if missing:
            raise ValueError(f"unknown golden-set ids: {', '.join(sorted(missing))}")
    if tags:
        want_tags = set(tags)
        selected = [
            case
            for case in selected
            if want_tags.intersection(_case_get(case, "tags") or [])
        ]
    return selected


def _serialize_reply(reply: ChatReply | None) -> dict[str, Any] | None:
    if reply is None:
        return None
    return reply.model_dump(mode="json")


def _applied_updates(form_state: dict[str, Any], state: dict[str, Any]) -> dict | None:
    reply: ChatReply | None = state.get("reply")
    if reply is None or not reply.form_changes_intended or reply.form_updates is None:
        return None
    return strip_unchanged_updates(
        form_state or {},
        reply.form_updates.model_dump(exclude_none=True),
        raw_updates=state.get("raw_updates"),
    )


def run_case(graph: Any, case: Any) -> dict[str, Any]:
    """Run one golden-set case."""
    case_id = _case_get(case, "id")
    user_message = _case_get(case, "user_message", "")
    form_state = dict(_case_get(case, "form_state") or {})
    history = list(_case_get(case, "history") or [])
    expect = _case_get(case, "expect") or {}
    if hasattr(expect, "model_dump"):
        expect = expect.model_dump(exclude_none=True)
    tags = list(_case_get(case, "tags") or [])

    search_queries: list[str] = []

    def _fake_search(queries: list[str]) -> list[dict[str, str]]:
        search_queries.extend(queries)
        return list(STUB_SOURCES)

    started = time.perf_counter()
    error: str | None = None
    state: dict[str, Any] = {}
    try:
        with patch(
            "chat.chat_agent.search_chemistry_sources",
            side_effect=_fake_search,
        ):
            state = graph.invoke(
                {
                    "user_message": user_message,
                    "history": compact_history(history),
                    "form_state": form_state,
                }
            )
    except HTTPException as exc:
        error = f"HTTP {exc.status_code}: {exc.detail}"
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
    latency_s = time.perf_counter() - started

    reply: ChatReply | None = state.get("reply")
    raw_message = reply.message if reply is not None else ""
    retrieved = list(state.get("sources") or [])
    display_message, cited_sources = prepare_cited_sources_for_display(
        raw_message, retrieved
    )
    applied = _applied_updates(form_state, state) if reply is not None else None

    return {
        "id": case_id,
        "tags": tags,
        "expect": expect,
        "error": error,
        "latency_s": round(latency_s, 3),
        "search_called": bool(search_queries),
        "search_queries": search_queries,
        "retrieved_sources": retrieved,
        "attempts": int(state.get("attempts") or 0),
        "validation_errors": list(
            state.get("validation_error_log") or state.get("validation_errors") or []
        ),
        "form_changes_intended": (
            None if reply is None else bool(reply.form_changes_intended)
        ),
        "reply": _serialize_reply(reply),
        "raw_updates": state.get("raw_updates"),
        "applied_updates": applied,
        "message": display_message,
        "cited_sources": cited_sources,
        "form_state": form_state,
    }


def run_eval(
    cases: list[Any],
    *,
    graph: Any | None = None,
) -> list[dict[str, Any]]:
    compiled = graph if graph is not None else build_graph()
    rows: list[dict[str, Any]] = []
    for case in cases:
        result = run_case(compiled, case)
        retries = 0
        while (
            result["error"]
            and "HTTP 429" in result["error"]
            and "daily token limit" not in result["error"]
            and retries < _RATE_LIMIT_RETRIES
        ):
            retries += 1
            print(
                f"  {_case_get(case, 'id')}: 429, "
                f"retry {retries}/{_RATE_LIMIT_RETRIES} in {_RATE_LIMIT_WAIT_S:.0f}s"
            )
            time.sleep(_RATE_LIMIT_WAIT_S)
            result = run_case(compiled, case)
        scores = {} if result["error"] else score_case(case, result)
        passed = None
        if result["error"]:
            passed = False
        elif scores:
            passed = all(float(value) >= 1.0 for value in scores.values())
        rows.append({**result, "scores": scores, "passed": passed})
    return rows


def _write_results(rows: list[dict[str, Any]], out_path: Path, golden_set: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "meta": {
            "provider": chat_provider(),
            "model": chat_model(),
            "reasoning_effort": REASONING_EFFORT,
            "golden_set": str(golden_set),
            "search_stubbed": True,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "n_cases": len(rows),
        },
        "cases": rows,
    }
    out_path.write_text(json.dumps(payload, indent=2) + "\n")


def _pass_rate(rows: list[dict[str, Any]]) -> tuple[int, int, float]:
    n_total = len(rows)
    n_pass = sum(1 for row in rows if row.get("passed") is True)
    rate = (n_pass / n_total) if n_total else 0.0
    return n_pass, n_total, rate


def _below_pass_rate(rows: list[dict[str, Any]], min_pass_rate: float) -> bool:
    if min_pass_rate <= 0:
        return False
    _n_pass, n_total, rate = _pass_rate(rows)
    return n_total == 0 or rate < min_pass_rate


def _print_summary(rows: list[dict[str, Any]]) -> None:
    scored = [row for row in rows if row["passed"] is not None]
    print(f"{'id':<36} {'result':<8} {'latency':>8}  scores")
    print("-" * 80)
    for row in rows:
        if row["error"]:
            result = "error"
        elif row["passed"] is True:
            result = "pass"
        elif row["passed"] is False:
            result = "fail"
        else:
            result = "unscored"
        score_bits = " ".join(
            f"{name}={value:g}" for name, value in (row.get("scores") or {}).items()
        )
        print(
            f"{str(row['id']):<36} {result:<8} {row['latency_s']:>7.2f}s  {score_bits}"
        )
        if row["error"]:
            print(f"  {row['error']}")
    print("-" * 80)
    n_pass, n_total, rate = _pass_rate(rows)
    if scored:
        print(f"{n_pass}/{n_total} cases passed ({rate:.0%})")
    else:
        print(f"{n_total} cases run. chat.evals.scorers.score_case is not defined.")


def main(argv: list[str] | None = None) -> int:
    load_dotenv(_REPO_ROOT / ".env")

    parser = argparse.ArgumentParser(
        description="Run golden-set cases through the dataset-generator chat graph."
    )
    parser.add_argument(
        "--golden-set",
        type=Path,
        default=DEFAULT_GOLDEN_SET,
        help="JSONL golden set.",
    )
    parser.add_argument("--id", action="append", dest="ids", help="Run only this case id.")
    parser.add_argument("--tag", action="append", dest="tags", help="Run cases with this tag.")
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="JSON result file.",
    )
    parser.add_argument(
        "--min-pass-rate",
        type=float,
        default=0.0,
        help="Exit 1 if passed/total is below this fraction. Default 0.",
    )
    args = parser.parse_args(argv)
    if not 0.0 <= args.min_pass_rate <= 1.0:
        raise SystemExit("--min-pass-rate must be between 0 and 1.")

    if api_key_error := chat_api_key_error():
        raise SystemExit(api_key_error)

    cases = select_cases(load_cases(args.golden_set), ids=args.ids, tags=args.tags)
    if not cases:
        raise SystemExit("no golden-set cases matched.")

    rows = run_eval(cases)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_path = args.out or (DEFAULT_RESULTS_DIR / f"{stamp}.json")
    _write_results(rows, out_path, args.golden_set)
    _print_summary(rows)
    print(f"wrote {out_path}")
    if _below_pass_rate(rows, args.min_pass_rate):
        n_pass, n_total, rate = _pass_rate(rows)
        print(
            f"pass rate {n_pass}/{n_total} ({rate:.0%}) "
            f"is below --min-pass-rate {args.min_pass_rate:.0%}"
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
