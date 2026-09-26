from unittest.mock import MagicMock

from fastapi import HTTPException

from chat.evals.runner import run_case, run_eval
from chat.evals.scorers import score_case
from chat.form_contracts import ChatReply


def test_run_eval_retries_429(monkeypatch):
    graph = MagicMock()
    graph.invoke.side_effect = [
        HTTPException(
            status_code=429,
            detail="The model provider is rate-limited. Wait a few seconds and try again.",
        ),
        {
            "reply": ChatReply(
                message="Noise is added error.",
                form_changes_intended=False,
                form_updates=None,
            ),
            "sources": [],
            "attempts": 1,
            "validation_errors": [],
            "raw_updates": None,
        },
    ]
    monkeypatch.setattr("chat.evals.runner.time.sleep", lambda _s: None)

    rows = run_eval(
        [
            {
                "id": "info-noise",
                "user_message": "what does noise mean?",
                "form_state": {},
                "history": [],
                "expect": {
                    "form_changes_intended": False,
                    "has_form_updates": False,
                    "search_called": False,
                },
                "tags": ["intent"],
            }
        ],
        graph=graph,
    )

    assert rows[0]["passed"] is True
    assert rows[0]["error"] is None
    assert graph.invoke.call_count == 2


def test_run_case_persists_validation_error_log():
    graph = MagicMock()
    graph.invoke.return_value = {
        "reply": ChatReply(
            message="Corrected names.",
            form_changes_intended=True,
            form_updates=None,
        ),
        "sources": [],
        "attempts": 2,
        "validation_errors": [],
        "validation_error_log": [
            "formulation_groups: ingredient 'TPO (photoinitiator)' uses parentheses as an annotation."
        ],
        "raw_updates": None,
    }
    result = run_case(
        graph,
        {
            "id": "setup-dlp",
            "user_message": "Set up a UV-curable DLP resin dataset.",
            "form_state": {},
            "history": [],
            "expect": {"form_changes_intended": True},
            "tags": ["setup"],
        },
    )
    assert result["validation_errors"] == [
        "formulation_groups: ingredient 'TPO (photoinitiator)' uses parentheses as an annotation."
    ]


def test_score_require_citations_accepts_title_brackets():
    case = {
        "id": "cite-photoinitiator-claims",
        "expect": {"require_citations": True, "citations_subset": True},
    }
    message = (
        "TPO is preferred for 405 nm【Eval source 1】. "
        "Irgacure 819 offers deep cure【Eval source 2】."
    )
    result = {
        "message": message,
        "reply": {"message": message},
        "cited_sources": [],
        "retrieved_sources": [
            {
                "title": "Eval source 1",
                "url": "https://example.com/eval/source-1",
            },
            {
                "title": "Eval source 2",
                "url": "https://example.com/eval/source-2",
            },
        ],
    }
    scores = score_case(case, result)
    assert scores["require_citations"] == 1.0
    assert scores["citations_subset"] == 1.0
