import json

from routers.chat import (
    _normalize_formulation_descriptors,
    _normalize_num,
    _strip_unchanged_updates,
)


class _FakeCompletionMessage:
    def __init__(self, content: str):
        self.content = content


class _FakeCompletionChoice:
    def __init__(self, content: str):
        self.message = _FakeCompletionMessage(content)


class _FakeCompletionResponse:
    def __init__(self, content: str):
        self.choices = [_FakeCompletionChoice(content)]


class _FakeCompletions:
    def __init__(self, content: str):
        self._content = content

    def create(self, **kwargs):
        return _FakeCompletionResponse(self._content)


class _FakeChat:
    def __init__(self, content: str):
        self.completions = _FakeCompletions(content)


class _FakeGroq:
    def __init__(self, api_key: str, content: str):
        self.chat = _FakeChat(content)


def test_normalize_num_coerces_equivalent_numbers():
    assert _normalize_num(0) == "0.0"
    assert _normalize_num("0.0") == "0.0"
    assert _normalize_num("3") == "3.0"
    assert _normalize_num("abc") == "abc"


def test_strip_unchanged_updates_prunes_to_none_when_identical():
    form_state = {
        "general_inputs": [{"name": "Temp", "min": "20", "max": "80", "units": "C"}],
        "formulation_inputs": [{"name": "Monomer A", "min": "0.1", "max": "0.8"}],
        "outputs": [{"name": "Strength", "min": "10", "max": "90", "units": "MPa"}],
        "num_rows": 100,
        "noise": 0.025,
        "filename": "demo.csv",
        "min_ingredients_per_formulation": 2,
        "max_ingredients_per_formulation": 4,
    }
    incoming = {
        "general_inputs": [{"name": "Temp", "min": 20, "max": 80.0, "units": "C"}],
        "formulation_inputs": [{"name": "Monomer A", "min": 0.1, "max": 0.8, "units": ""}],
        "outputs": [{"name": "Strength", "min": "10.0", "max": "90.0", "units": "MPa"}],
        "num_rows": "100",
        "noise": "0.025",
        "filename": "demo.csv",
        "min_ingredients_per_formulation": 2,
        "max_ingredients_per_formulation": 4,
    }

    assert _strip_unchanged_updates(form_state, incoming) is None


def test_normalize_formulation_descriptors_includes_required():
    items = [
        {"name": "Base", "min": "0.5", "max": "0.9", "required": True},
        {"name": "Additive", "min": "0.001", "max": "0.02"},
    ]
    assert _normalize_formulation_descriptors(items) == [
        ("Base", "0.5", "0.9", True),
        ("Additive", "0.001", "0.02", False),
    ]


def test_strip_unchanged_updates_detects_required_toggle_change():
    form_state = {
        "formulation_inputs": [
            {"name": "Ice Cream Base", "min": "0.5", "max": "0.9", "required": False},
            {"name": "DATEM", "min": "0.001", "max": "0.015", "required": False},
        ],
    }
    incoming = {
        "formulation_inputs": [
            {"name": "Ice Cream Base", "min": "0.5", "max": "0.9", "required": True},
            {"name": "DATEM", "min": "0.001", "max": "0.015", "required": False},
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
    monkeypatch.setattr("routers.chat.Groq", lambda api_key: _FakeGroq(api_key=api_key, content=llm_json))

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
    monkeypatch.setattr("routers.chat.Groq", lambda api_key: _FakeGroq(api_key=api_key, content=llm_json))

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
