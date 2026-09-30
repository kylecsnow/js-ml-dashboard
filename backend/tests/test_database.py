from pathlib import Path

import pytest

from database import DATABASE_PATH, resolve_database_url


def test_defaults_to_sqlite_when_unconfigured():
    assert resolve_database_url({}) == f"sqlite:///{DATABASE_PATH}"


def test_explicit_database_url_wins():
    url = resolve_database_url({"DATABASE_URL": "postgresql+psycopg://u:p@db:5432/app"})
    assert url == "postgresql+psycopg://u:p@db:5432/app"


def test_builds_postgres_url_from_parts():
    url = resolve_database_url(
        {
            "POSTGRES_HOST": "js-ml-dashboard-db",
            "POSTGRES_PORT": "5432",
            "POSTGRES_DB": "js_ml_dashboard",
            "POSTGRES_USER": "user",
            "POSTGRES_PASSWORD": "p@ss/word",
        }
    )
    assert url == (
        "postgresql+psycopg://user:p%40ss%2Fword@js-ml-dashboard-db:5432/js_ml_dashboard"
    )


def test_incomplete_postgres_env_raises():
    with pytest.raises(RuntimeError, match="Incomplete Postgres config"):
        resolve_database_url({"POSTGRES_HOST": "js-ml-dashboard-db"})


def test_sqlite_path_is_backend_schemas_db():
    assert DATABASE_PATH == Path(__file__).resolve().parents[1] / "schemas.db"
