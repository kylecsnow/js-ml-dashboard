import uuid

import pytest

MINIMAL_CONFIG = {
    "generalInputs": [],
    "formulationInputs": [],
    "outputs": [],
    "numRows": 50,
    "noise": 0.025,
    "filename": "generated_dataset",
    "minIngredientsPerFormulation": "",
    "maxIngredientsPerFormulation": "",
}


@pytest.fixture
def schema_id(client):
    name = f"test-schema-{uuid.uuid4()}"
    response = client.post(
        "/api/schemas",
        json={"name": name, "config": MINIMAL_CONFIG},
    )
    assert response.status_code == 201
    created_id = response.json()["id"]
    yield created_id
    client.delete(f"/api/schemas/{created_id}")


def test_list_schemas_returns_schemas_key(client):
    response = client.get("/api/schemas")
    assert response.status_code == 200
    assert "schemas" in response.json()


def test_create_schema_requires_name(client):
    response = client.post("/api/schemas", json={"config": MINIMAL_CONFIG})
    assert response.status_code == 400
    assert response.json()["detail"] == "Schema name is required."


def test_create_schema_requires_config(client):
    response = client.post("/api/schemas", json={"name": "Missing config"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Schema config is required."


def test_create_schema_strips_name(client):
    name = f"  test-schema-{uuid.uuid4()}  "
    response = client.post(
        "/api/schemas",
        json={"name": name, "config": MINIMAL_CONFIG},
    )
    assert response.status_code == 201
    schema_id = response.json()["id"]
    assert response.json()["name"] == name.strip()

    list_response = client.get("/api/schemas")
    saved = next(s for s in list_response.json()["schemas"] if s["id"] == schema_id)
    assert saved["name"] == name.strip()
    assert saved["config"] == MINIMAL_CONFIG

    client.delete(f"/api/schemas/{schema_id}")


def test_rename_schema(client, schema_id):
    response = client.patch(
        f"/api/schemas/{schema_id}",
        json={"name": "Renamed Schema"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == schema_id
    assert data["name"] == "Renamed Schema"
    assert data["created_at"] is not None

    list_response = client.get("/api/schemas")
    saved = next(s for s in list_response.json()["schemas"] if s["id"] == schema_id)
    assert saved["name"] == "Renamed Schema"
    assert saved["config"] == MINIMAL_CONFIG


def test_rename_schema_strips_whitespace(client, schema_id):
    response = client.patch(
        f"/api/schemas/{schema_id}",
        json={"name": "  Trimmed Name  "},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Trimmed Name"


def test_rename_schema_requires_name(client, schema_id):
    response = client.patch(f"/api/schemas/{schema_id}", json={"name": ""})
    assert response.status_code == 400
    assert response.json()["detail"] == "Schema name is required."

    response = client.patch(f"/api/schemas/{schema_id}", json={"name": "   "})
    assert response.status_code == 400
    assert response.json()["detail"] == "Schema name is required."


def test_rename_schema_not_found(client):
    response = client.patch(
        "/api/schemas/999999999",
        json={"name": "Does Not Exist"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Schema not found."


def test_delete_schema(client, schema_id):
    response = client.delete(f"/api/schemas/{schema_id}")
    assert response.status_code == 200
    assert response.json()["detail"] == "Schema deleted."

    list_response = client.get("/api/schemas")
    assert schema_id not in {s["id"] for s in list_response.json()["schemas"]}


def test_delete_schema_not_found(client):
    response = client.delete("/api/schemas/999999999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Schema not found."
