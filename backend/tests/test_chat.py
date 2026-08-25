import json

from routers.chat import (
    _extract_json_object,
    _normalize_formulation_groups,
    _normalize_num,
    _strip_unchanged_updates,
)


def test_extract_json_object_strips_surrounding_prose():
    raw = (
        'Sure! Here is the update:\n```json\n'
        '{"message": "Updated.", "form_changes_intended": true, '
        '"form_updates": {"num_rows": 200}}\n```\nLet me know if that helps.'
    )
    assert json.loads(_extract_json_object(raw)) == {
        "message": "Updated.",
        "form_changes_intended": True,
        "form_updates": {"num_rows": 200},
    }


def test_extract_json_object_handles_braces_inside_strings():
    raw = '{"message": "use {braces} in text", "form_updates": null}'
    assert json.loads(_extract_json_object(raw))["message"] == "use {braces} in text"


class _FakeToolCall:
    def __init__(self, id: str, name: str, arguments: str):
        self.id = id
        self.function = type("F", (), {"name": name, "arguments": arguments})()


class _FakeCompletionMessage:
    def __init__(self, content: str | None, tool_calls: list | None = None):
        self.content = content
        self.tool_calls = tool_calls or None


class _FakeCompletionChoice:
    def __init__(self, content: str | None, tool_calls: list | None = None):
        self.message = _FakeCompletionMessage(content, tool_calls)
        self.finish_reason = "tool_calls" if tool_calls else "stop"


class _FakeCompletionResponse:
    def __init__(self, content: str | None, tool_calls: list | None = None):
        self.choices = [_FakeCompletionChoice(content, tool_calls)]


def _tool_call(id: str, name: str, arguments: dict) -> _FakeToolCall:
    return _FakeToolCall(id, name, json.dumps(arguments))


class _FakeCompletions:
    def __init__(self, responses: list):
        # Each entry: {"content": str|None, "tool_calls": [...] | None}
        self._responses = list(responses)
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        spec = self._responses.pop(0) if len(self._responses) > 1 else self._responses[0]
        return _FakeCompletionResponse(spec["content"], spec.get("tool_calls"))


class _FakeChat:
    def __init__(self, responses: list):
        self.completions = _FakeCompletions(responses)


class _FakeGroq:
    def __init__(self, api_key: str, responses: list):
        self.chat = _FakeChat(responses)


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
                "ingredients": [{"name": "Monomer A", "min": "0.1", "max": "0.8", "required": False}],
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
                "ingredients": [{"name": "Monomer A", "min": 0.1, "max": 0.8, "required": False}],
            }
        ],
        "outputs": [{"name": "Strength", "min": "10.0", "max": "90.0", "units": "MPa"}],
        "num_rows": "100",
        "noise": "0.025",
        "filename": "demo.csv",
        "min_ingredients_per_formulation": 2,
        "max_ingredients_per_formulation": 4,
    }

    assert _strip_unchanged_updates(form_state, incoming) is None


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
        ("Additives", "0.001", "0.02", "", "", (("Stabilizer", "0.001", "0.02", False),)),
    ]


def test_strip_unchanged_updates_detects_required_toggle_change():
    form_state = {
        "formulation_groups": [
            {
                "name": "Base",
                "min": "0.5",
                "max": "0.9",
                "ingredients": [
                    {"name": "Ice Cream Base", "min": "0.5", "max": "0.9", "required": False},
                    {"name": "DATEM", "min": "0.001", "max": "0.015", "required": False},
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
                    {"name": "Ice Cream Base", "min": "0.5", "max": "0.9", "required": True},
                    {"name": "DATEM", "min": "0.001", "max": "0.015", "required": False},
                ],
            },
        ],
    }

    cleaned = _strip_unchanged_updates(form_state, incoming)
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

    cleaned = _strip_unchanged_updates(form_state, incoming)
    assert cleaned == {
        "general_inputs": [{"name": "Temp", "min": "20", "max": "85", "units": "C"}],
        "noise": 0.05,
        "min_ingredients_per_formulation": 2,
    }


def test_chat_dataset_generator_requires_api_key(client, monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    response = client.post(
        "/api/chat/dataset-generator",
        json={"message": "help me build a dataset", "conversation_history": [], "form_state": {}},
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


def test_chat_dataset_generator_ignores_updates_when_no_form_changes(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    llm_json = json.dumps(
        {
            "message": "Here is guidance only.",
            "form_changes_intended": False,
            "form_updates": {"noise": 0.1},
        }
    )
    monkeypatch.setattr(
        "routers.chat.Groq", lambda api_key: _FakeGroq(api_key=api_key, responses=[{"content": llm_json}])
    )

    response = client.post(
        "/api/chat/dataset-generator",
        json={"message": "what does noise mean?", "conversation_history": [], "form_state": {"noise": 0.025}},
    )
    assert response.status_code == 200
    assert response.json() == {"message": "Here is guidance only."}


def test_chat_dataset_generator_returns_only_changed_form_updates(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    llm_json = json.dumps(
        {
            "message": "Updated the form.",
            "form_changes_intended": True,
            "form_updates": {
                "general_inputs": [
                    {"name": "Temp", "min": "20", "max": "80", "units": "C"},
                ],
                "noise": 0.05,
            },
        }
    )
    monkeypatch.setattr(
        "routers.chat.Groq", lambda api_key: _FakeGroq(api_key=api_key, responses=[{"content": llm_json}])
    )

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


def test_chat_dataset_generator_runs_web_search_tool_when_requested(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    fake_sources = [
        {
            "title": "UV Resin Guide",
            "url": "https://example.com/guide",
            "snippet": "Typical photoinitiator loading is low.",
        }
    ]
    final_json = json.dumps(
        {
            "message": "See [guide](https://example.com/guide) for typical ranges.",
            "form_changes_intended": False,
        }
    )
    responses = [
        {"content": None, "tool_calls": [_tool_call("call_1", "web_search", {"query": "Irganox 819"})]},
        {"content": final_json},
    ]
    monkeypatch.setattr(
        "routers.chat.Groq", lambda api_key: _FakeGroq(api_key=api_key, responses=responses)
    )
    monkeypatch.setattr(
        "routers.chat.search_chemistry_sources", lambda queries: fake_sources
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
    assert data["message"] == "See [guide](https://example.com/guide) for typical ranges."
    assert data["sources"] == fake_sources


def test_chat_dataset_generator_skips_tool_for_pure_form_edit(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    llm_json = json.dumps(
        {
            "message": "Done.",
            "form_changes_intended": True,
            "form_updates": {"num_rows": 200},
        }
    )
    responses = [{"content": llm_json}]
    monkeypatch.setattr(
        "routers.chat.Groq", lambda api_key: _FakeGroq(api_key=api_key, responses=responses)
    )
    search_calls: list = []
    monkeypatch.setattr(
        "routers.chat.search_chemistry_sources",
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

    invalid_json = json.dumps(
        {
            "message": "Updated.",
            "form_changes_intended": True,
            "form_updates": {
                "formulation_groups": [
                    {
                        "name": "Base",
                        "min": "0.9",
                        "max": "0.5",  # min > max -> invalid
                        "ingredients": [
                            {"name": "Resin", "min": "0.5", "max": "0.9", "required": True},
                        ],
                    }
                ]
            },
        }
    )
    valid_json = json.dumps(
        {
            "message": "Updated.",
            "form_changes_intended": True,
            "form_updates": {
                "formulation_groups": [
                    {
                        "name": "Base",
                        "min": "0.5",
                        "max": "1.0",
                        "ingredients": [
                            {"name": "Resin", "min": "0.5", "max": "0.9", "required": True},
                        ],
                    }
                ]
            },
        }
    )
    responses = [{"content": invalid_json}, {"content": valid_json}]
    fake = _FakeGroq(api_key="test-key", responses=responses)
    monkeypatch.setattr("routers.chat.Groq", lambda api_key: fake)

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
    assert "form_updates" in data
    group = data["form_updates"]["formulation_groups"][0]
    assert group["min"] == "0.5" and group["max"] == "1.0"

    # Two LLM calls total: the bad one, then the corrected one.
    assert len(fake.chat.completions.calls) == 2
    # The second request carried the validator's feedback to the model.
    feedback = fake.chat.completions.calls[1]["messages"][-1]
    assert feedback["role"] == "user"
    assert "validator" in feedback["content"].lower() or "rejected" in feedback["content"].lower()


def test_chat_dataset_generator_drops_updates_when_validation_keeps_failing(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    invalid_json = json.dumps(
        {
            "message": "Updated.",
            "form_changes_intended": True,
            "form_updates": {
                "general_inputs": [
                    {"name": "Defoamer (Polyglycol)", "min": "1", "max": "9", "units": "mg/L"},
                ]
            },
        }
    )
    responses = [{"content": invalid_json}]  # same (bad) reply on every retry
    fake = _FakeGroq(api_key="test-key", responses=responses)
    monkeypatch.setattr("routers.chat.Groq", lambda api_key: fake)

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
    # No invalid updates leaked to the client; the user is told why.
    assert "form_updates" not in data
    assert "validation" in data["message"]
    # 1 initial attempt + MAX_CORRECTION_ATTEMPTS retries.
    assert len(fake.chat.completions.calls) == 3


def test_chat_dataset_generator_reports_malformed_json(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setattr(
        "routers.chat.Groq",
        lambda api_key: _FakeGroq(api_key=api_key, responses=[{"content": "not json at all"}]),
    )
    response = client.post(
        "/api/chat/dataset-generator",
        json={"message": "hello", "conversation_history": [], "form_state": {}},
    )
    assert response.status_code == 502
    assert "invalid JSON" in response.json()["detail"]


def test_chat_dataset_generator_rejects_wrong_typed_fields(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    # num_rows must be an integer; a string should fail the typed contract.
    bad_json = json.dumps(
        {
            "message": "Updated.",
            "form_changes_intended": True,
            "form_updates": {"num_rows": "two hundred"},
        }
    )
    monkeypatch.setattr(
        "routers.chat.Groq", lambda api_key: _FakeGroq(api_key=api_key, responses=[{"content": bad_json}])
    )
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
