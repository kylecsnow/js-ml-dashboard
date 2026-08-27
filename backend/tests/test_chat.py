from langchain_core.messages import AIMessage
import json

from chat_agent import (
    SEARCH_PROMPT,
    _is_capacity_error,
    _normalize_formulation_groups,
    _normalize_num,
    _payload_from_parse_error,
    compact_history,
    strip_unchanged_updates,
)
from form_contracts import ChatReply, FormUpdates, parse_chat_reply
from form_validation import validate_form_updates


def test_search_prompt_does_not_request_json():
    assert "JSON" not in SEARCH_PROMPT
    assert "web_search" in SEARCH_PROMPT


def test_compact_history_keeps_recent_messages():
    history = [
        {"role": "user", "content": "first"},
        {"role": "assistant", "content": "ok"},
        {"role": "user", "content": "second"},
        {"role": "assistant", "content": "done"},
    ]
    compacted = compact_history(history)
    assert [m["content"] for m in compacted] == ["second", "done"]


def test_chat_reply_model_validate_accepts_group_sum_aliases():
    reply = ChatReply.model_validate(
        {
            "message": "Configured DLP resins.",
            "form_changes_intended": True,
            "form_updates": {
                "formulation_groups": [
                    {
                        "name": "Oligomer",
                        "group_sum_min": "0.3",
                        "group_sum_max": "0.7",
                        "ingredients": [
                            {
                                "name": "UDMA",
                                "min": "0.1",
                                "max": "0.5",
                                "required": True,
                            }
                        ],
                    }
                ]
            },
        }
    )
    group = reply.form_updates.formulation_groups[0]
    assert group.min == "0.3"
    assert group.max == "0.7"


def test_parse_chat_reply_accepts_group_sum_aliases():
    reply = parse_chat_reply(
        {
            "message": "Configured DLP resins.",
            "form_changes_intended": True,
            "form_updates": {
                "formulation_groups": [
                    {
                        "name": "Oligomer",
                        "group_sum_min": "0.3",
                        "group_sum_max": "0.7",
                        "ingredients": [
                            {
                                "name": "UDMA",
                                "min": "0.1",
                                "max": "0.5",
                                "required": True,
                            }
                        ],
                    }
                ]
            },
        }
    )
    group = reply.form_updates.formulation_groups[0]
    assert group.min == "0.3"
    assert group.max == "0.7"


def test_parse_chat_reply_recovers_include_raw_content_blocks():
    payload = {
        "message": "Configured DLP resins.",
        "form_changes_intended": True,
        "form_updates": {
            "formulation_groups": [
                {
                    "name": "Oligomer",
                    "group_sum_min": "0.3",
                    "group_sum_max": "0.7",
                    "ingredients": [
                        {
                            "name": "UDMA",
                            "min": "0.1",
                            "max": "0.5",
                            "required": True,
                        }
                    ],
                }
            ]
        },
    }
    reply = parse_chat_reply(
        {
            "parsed": None,
            "parsing_error": ValueError("schema mismatch"),
            "raw": AIMessage(
                content=[
                    {"type": "reasoning", "text": "thinking about bounds"},
                    {"type": "text", "text": json.dumps(payload)},
                ]
            ),
        }
    )
    group = reply.form_updates.formulation_groups[0]
    assert group.min == "0.3"
    assert group.max == "0.7"


def test_group_sum_alias_updates_pass_form_validation():
    reply = parse_chat_reply(
        {
            "message": "Configured DLP resins.",
            "form_changes_intended": True,
            "form_updates": {
                "formulation_groups": [
                    {
                        "name": "Oligomer",
                        "group_sum_min": "0.3",
                        "group_sum_max": "0.7",
                        "ingredients": [
                            {
                                "name": "UDMA",
                                "min": "0.1",
                                "max": "0.5",
                                "required": True,
                            }
                        ],
                    },
                    {
                        "name": "Monomer",
                        "group_sum_min": "0.3",
                        "group_sum_max": "0.7",
                        "ingredients": [
                            {
                                "name": "IBOA",
                                "min": "0.0",
                                "max": "0.5",
                                "required": False,
                            }
                        ],
                    },
                ]
            },
        }
    )
    assert validate_form_updates({}, reply.form_updates) == []


def test_payload_from_parse_error_recovers_embedded_json():
    exc = ValueError(
        'Failed to parse ChatReply from completion {"message": "ok", '
        '"form_changes_intended": true, "form_updates": null}. Got: 1 validation error'
    )
    assert _payload_from_parse_error(exc)["message"] == "ok"


def test_normalize_num_coerces_equivalent_numbers():
    assert _normalize_num(0) == "0.0"
    assert _normalize_num("0.0") == "0.0"
    assert _normalize_num("3") == "3.0"
    assert _normalize_num("abc") == "abc"


def test_strip_unchanged_updates_prunes_to_none_when_identical():
    form_state = {
        "general_inputs": [{"name": "Temp", "min": "20", "max": "80", "units": "C"}],
        "formulation_groups": [
            {
                "name": "Monomers",
                "min": "0.5",
                "max": "0.9",
                "min_ingredients": 1,
                "max_ingredients": 2,
                "ingredients": [
                    {"name": "Monomer A", "min": "0.1", "max": "0.8", "required": False}
                ],
            }
        ],
        "outputs": [{"name": "Strength", "min": "10", "max": "90", "units": "MPa"}],
        "num_rows": 100,
        "noise": 0.025,
        "filename": "demo.csv",
        "min_ingredients_per_formulation": 2,
        "max_ingredients_per_formulation": 4,
    }
    incoming = {
        "general_inputs": [{"name": "Temp", "min": 20, "max": 80.0, "units": "C"}],
        "formulation_groups": [
            {
                "name": "Monomers",
                "min": 0.5,
                "max": 0.9,
                "min_ingredients": "1",
                "max_ingredients": "2",
                "ingredients": [
                    {"name": "Monomer A", "min": 0.1, "max": 0.8, "required": False}
                ],
            }
        ],
        "outputs": [{"name": "Strength", "min": "10.0", "max": "90.0", "units": "MPa"}],
        "num_rows": "100",
        "noise": "0.025",
        "filename": "demo.csv",
        "min_ingredients_per_formulation": 2,
        "max_ingredients_per_formulation": 4,
    }

    assert strip_unchanged_updates(form_state, incoming) is None


def test_normalize_formulation_groups_includes_counts_and_required():
    items = [
        {
            "name": "Base",
            "min": "0.5",
            "max": "0.9",
            "min_ingredients": 1,
            "max_ingredients": 1,
            "ingredients": [
                {"name": "Base Resin", "min": "0.5", "max": "0.9", "required": True},
            ],
        },
        {
            "name": "Additives",
            "min": "0.001",
            "max": "0.02",
            "ingredients": [
                {"name": "Stabilizer", "min": "0.001", "max": "0.02"},
            ],
        },
    ]
    assert _normalize_formulation_groups(items) == [
        ("Base", "0.5", "0.9", "1.0", "1.0", (("Base Resin", "0.5", "0.9", True),)),
        (
            "Additives",
            "0.001",
            "0.02",
            "",
            "",
            (("Stabilizer", "0.001", "0.02", False),),
        ),
    ]


def test_strip_unchanged_updates_detects_required_toggle_change():
    form_state = {
        "formulation_groups": [
            {
                "name": "Base",
                "min": "0.5",
                "max": "0.9",
                "ingredients": [
                    {
                        "name": "Ice Cream Base",
                        "min": "0.5",
                        "max": "0.9",
                        "required": False,
                    },
                    {
                        "name": "DATEM",
                        "min": "0.001",
                        "max": "0.015",
                        "required": False,
                    },
                ],
            },
        ],
    }
    incoming = {
        "formulation_groups": [
            {
                "name": "Base",
                "min": "0.5",
                "max": "0.9",
                "ingredients": [
                    {
                        "name": "Ice Cream Base",
                        "min": "0.5",
                        "max": "0.9",
                        "required": True,
                    },
                    {
                        "name": "DATEM",
                        "min": "0.001",
                        "max": "0.015",
                        "required": False,
                    },
                ],
            },
        ],
    }

    cleaned = strip_unchanged_updates(form_state, incoming)
    assert cleaned == incoming


def test_strip_unchanged_updates_keeps_only_changed_fields():
    form_state = {
        "general_inputs": [{"name": "Temp", "min": "20", "max": "80", "units": "C"}],
        "noise": 0.025,
        "min_ingredients_per_formulation": None,
    }
    incoming = {
        "general_inputs": [{"name": "Temp", "min": "20", "max": "85", "units": "C"}],
        "noise": 0.05,
        "min_ingredients_per_formulation": 2,
    }

    cleaned = strip_unchanged_updates(form_state, incoming)
    assert cleaned == {
        "general_inputs": [{"name": "Temp", "min": "20", "max": "85", "units": "C"}],
        "noise": 0.05,
        "min_ingredients_per_formulation": 2,
    }


class _FakeLLM:
    def __init__(self, responses: list):
        self._responses = list(responses)
        self.calls: list = []

    def bind_tools(self, tools):
        return self

    def with_structured_output(self, schema, **kwargs):
        return self

    def invoke(self, messages):
        self.calls.append(messages)
        spec = (
            self._responses.pop(0) if len(self._responses) > 1 else self._responses[0]
        )
        if isinstance(spec, Exception):
            raise spec
        return spec


def _patch_llms(monkeypatch, search, reply):
    monkeypatch.setattr("chat_agent._search_llm", lambda: search)
    monkeypatch.setattr("chat_agent._reply_llm", lambda: reply)


def test_chat_dataset_generator_requires_api_key(client, monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    response = client.post(
        "/api/chat/dataset-generator",
        json={
            "message": "help me build a dataset",
            "conversation_history": [],
            "form_state": {},
        },
    )
    assert response.status_code == 500
    assert response.json()["detail"] == "GROQ_API_KEY environment variable is not set."


def test_chat_dataset_generator_rejects_empty_message(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    response = client.post(
        "/api/chat/dataset-generator",
        json={"message": "   ", "conversation_history": [], "form_state": {}},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Message cannot be empty."


def test_chat_dataset_generator_ignores_updates_when_no_form_changes(
    client, monkeypatch
):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    search = _FakeLLM([AIMessage(content="OK")])
    reply = _FakeLLM(
        [
            ChatReply(
                message="Here is guidance only.",
                form_changes_intended=False,
                form_updates=FormUpdates(noise=0.1),
            )
        ]
    )
    _patch_llms(monkeypatch, search, reply)

    response = client.post(
        "/api/chat/dataset-generator",
        json={
            "message": "what does noise mean?",
            "conversation_history": [],
            "form_state": {"noise": 0.025},
        },
    )
    assert response.status_code == 200
    assert response.json() == {"message": "Here is guidance only."}


def test_chat_dataset_generator_returns_only_changed_form_updates(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    search = _FakeLLM([AIMessage(content="OK")])
    reply = _FakeLLM(
        [
            ChatReply(
                message="Updated the form.",
                form_changes_intended=True,
                form_updates=FormUpdates(
                    general_inputs=[
                        {"name": "Temp", "min": "20", "max": "80", "units": "C"}
                    ],
                    noise=0.05,
                ),
            )
        ]
    )
    _patch_llms(monkeypatch, search, reply)

    response = client.post(
        "/api/chat/dataset-generator",
        json={
            "message": "set noise to 0.05",
            "conversation_history": [],
            "form_state": {
                "general_inputs": [
                    {"name": "Temp", "min": "20", "max": "80", "units": "C"},
                ],
                "noise": 0.025,
            },
        },
    )
    assert response.status_code == 200
    assert response.json() == {
        "message": "Updated the form.",
        "form_updates": {"noise": 0.05},
    }


def test_chat_dataset_generator_runs_web_search_tool_when_requested(
    client, monkeypatch
):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    fake_sources = [
        {
            "title": "UV Resin Guide",
            "url": "https://example.com/guide",
            "snippet": "Typical photoinitiator loading is low.",
        }
    ]
    search = _FakeLLM(
        [
            AIMessage(
                content="",
                tool_calls=[
                    {
                        "name": "web_search",
                        "args": {"query": "Irganox 819"},
                        "id": "call_1",
                    }
                ],
            )
        ]
    )
    reply = _FakeLLM(
        [
            ChatReply(
                message="See [guide](https://example.com/guide) for typical ranges.",
                form_changes_intended=False,
            )
        ]
    )
    _patch_llms(monkeypatch, search, reply)
    monkeypatch.setattr(
        "chat_agent.search_chemistry_sources", lambda queries: fake_sources
    )

    response = client.post(
        "/api/chat/dataset-generator",
        json={
            "message": "search for Irganox 819",
            "conversation_history": [],
            "form_state": {},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert (
        data["message"] == "See [guide](https://example.com/guide) for typical ranges."
    )
    assert data["sources"] == fake_sources
    assert "Typical photoinitiator loading is low." not in str(reply.calls[0])


def test_chat_dataset_generator_skips_tool_for_pure_form_edit(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    search = _FakeLLM([AIMessage(content="OK")])
    reply = _FakeLLM(
        [
            ChatReply(
                message="Done.",
                form_changes_intended=True,
                form_updates=FormUpdates(num_rows=200),
            )
        ]
    )
    _patch_llms(monkeypatch, search, reply)
    search_calls: list = []
    monkeypatch.setattr(
        "chat_agent.search_chemistry_sources",
        lambda queries: search_calls.append(queries) or [],
    )

    response = client.post(
        "/api/chat/dataset-generator",
        json={
            "message": "change the number of rows to 200",
            "conversation_history": [],
            "form_state": {"num_rows": 100},
        },
    )
    assert response.status_code == 200
    assert response.json() == {
        "message": "Done.",
        "form_updates": {"num_rows": 200},
    }
    assert search_calls == []


def test_chat_dataset_generator_retries_invalid_form_updates(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    invalid = ChatReply(
        message="Updated.",
        form_changes_intended=True,
        form_updates=FormUpdates(
            formulation_groups=[
                {
                    "name": "Base",
                    "min": "0.9",
                    "max": "0.5",
                    "ingredients": [
                        {
                            "name": "Resin",
                            "min": "0.5",
                            "max": "0.9",
                            "required": True,
                        }
                    ],
                }
            ]
        ),
    )
    valid = ChatReply(
        message="Updated.",
        form_changes_intended=True,
        form_updates=FormUpdates(
            formulation_groups=[
                {
                    "name": "Base",
                    "min": "0.5",
                    "max": "1.0",
                    "ingredients": [
                        {
                            "name": "Resin",
                            "min": "0.5",
                            "max": "0.9",
                            "required": True,
                        }
                    ],
                }
            ]
        ),
    )
    search = _FakeLLM([AIMessage(content="OK")])
    reply = _FakeLLM([invalid, valid])
    _patch_llms(monkeypatch, search, reply)

    response = client.post(
        "/api/chat/dataset-generator",
        json={
            "message": "add a base resin",
            "conversation_history": [],
            "form_state": {"formulation_groups": []},
        },
    )
    assert response.status_code == 200
    data = response.json()
    group = data["form_updates"]["formulation_groups"][0]
    assert group["min"] == "0.5" and group["max"] == "1.0"
    assert len(reply.calls) == 2
    feedback = reply.calls[1][-1].content.lower()
    assert "validator" in feedback or "rejected" in feedback


def test_chat_dataset_generator_drops_updates_when_validation_keeps_failing(
    client, monkeypatch
):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    invalid = ChatReply(
        message="Updated.",
        form_changes_intended=True,
        form_updates=FormUpdates(
            general_inputs=[
                {
                    "name": "Defoamer (Polyglycol)",
                    "min": "1",
                    "max": "9",
                    "units": "mg/L",
                }
            ]
        ),
    )
    search = _FakeLLM([AIMessage(content="OK")])
    reply = _FakeLLM([invalid])
    _patch_llms(monkeypatch, search, reply)

    response = client.post(
        "/api/chat/dataset-generator",
        json={
            "message": "add a defoamer",
            "conversation_history": [],
            "form_state": {},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "form_updates" not in data
    assert "validation" in data["message"]
    assert len(reply.calls) == 2


def test_chat_dataset_generator_accepts_group_sum_min_max_aliases(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    payload = {
        "message": "Configured DLP resins.",
        "form_changes_intended": True,
        "form_updates": {
            "formulation_groups": [
                {
                    "name": "Oligomer",
                    "group_sum_min": "0.3",
                    "group_sum_max": "0.7",
                    "ingredients": [
                        {
                            "name": "UDMA",
                            "min": "0.1",
                            "max": "0.5",
                            "required": True,
                        }
                    ],
                },
                {
                    "name": "Monomer",
                    "group_sum_min": "0.3",
                    "group_sum_max": "0.7",
                    "ingredients": [
                        {
                            "name": "IBOA",
                            "min": "0.0",
                            "max": "0.5",
                            "required": False,
                        }
                    ],
                },
            ]
        },
    }
    search = _FakeLLM([AIMessage(content="OK")])
    reply = _FakeLLM(
        [
            {
                "parsed": None,
                "parsing_error": ValueError(
                    "Failed to parse ChatReply from completion "
                    + json.dumps(payload)
                    + ". Got: 4 validation errors for ChatReply"
                ),
                "raw": AIMessage(
                    content=[
                        {"type": "reasoning", "text": "planning groups"},
                        {"type": "text", "text": json.dumps(payload)},
                    ]
                ),
            }
        ]
    )
    _patch_llms(monkeypatch, search, reply)

    response = client.post(
        "/api/chat/dataset-generator",
        json={
            "message": "set up a DLP resin dataset",
            "conversation_history": [],
            "form_state": {},
        },
    )
    assert response.status_code == 200
    groups = response.json()["form_updates"]["formulation_groups"]
    assert groups[0]["min"] == "0.3" and groups[0]["max"] == "0.7"
    assert groups[1]["min"] == "0.3" and groups[1]["max"] == "0.7"


def test_chat_dataset_generator_reports_malformed_json(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    search = _FakeLLM([AIMessage(content="OK")])
    reply = _FakeLLM([ValueError("invalid JSON")])
    _patch_llms(monkeypatch, search, reply)

    response = client.post(
        "/api/chat/dataset-generator",
        json={"message": "hello", "conversation_history": [], "form_state": {}},
    )
    assert response.status_code == 502
    assert "invalid JSON" in response.json()["detail"]


def test_chat_dataset_generator_rejects_wrong_typed_fields(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    search = _FakeLLM([AIMessage(content="OK")])
    reply = _FakeLLM(
        [{"message": "Updated.", "form_updates": {"num_rows": "two hundred"}}]
    )
    _patch_llms(monkeypatch, search, reply)

    response = client.post(
        "/api/chat/dataset-generator",
        json={
            "message": "change the rows",
            "conversation_history": [],
            "form_state": {},
        },
    )
    assert response.status_code == 502
    assert "malformed" in response.json()["detail"]


def test_is_capacity_error_detects_tpm_413():
    class _Err(Exception):
        status_code = 413

    assert _is_capacity_error(_Err("tokens per minute")) is True
    assert _is_capacity_error(ValueError("invalid JSON")) is False


def test_chat_dataset_generator_does_not_retry_tpm_413(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")

    class _Err(Exception):
        status_code = 413

        def __str__(self):
            return "tokens per minute (TPM): Limit 8000, Requested 10909"

    search = _FakeLLM([AIMessage(content="OK")])
    reply = _FakeLLM([_Err()])
    _patch_llms(monkeypatch, search, reply)

    response = client.post(
        "/api/chat/dataset-generator",
        json={
            "message": "tell me about EDTA",
            "conversation_history": [],
            "form_state": {},
        },
    )
    assert response.status_code == 429
    assert "rate-limited" in response.json()["detail"]
    assert len(reply.calls) == 1
