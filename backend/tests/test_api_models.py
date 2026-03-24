from pathlib import Path


def test_list_models_returns_models_key_and_list(client):
    response = client.get("/api/models")
    assert response.status_code == 200
    data = response.json()
    assert "models" in data
    assert isinstance(data["models"], list)


def test_list_models_includes_checked_in_pickle_stems(client):
    """Asserts repo sample model(s) appear; skip if models dir is empty locally."""
    models_dir = Path(__file__).resolve().parent.parent / "models"
    expected = {p.stem for p in models_dir.glob("*.pkl")}
    if not expected:
        import pytest

        pytest.skip("No *.pkl files in backend/models")

    response = client.get("/api/models")
    names = set(response.json()["models"])
    assert expected <= names
