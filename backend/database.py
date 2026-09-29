import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Mapping
from urllib.parse import quote_plus

from sqlalchemy import Column, DateTime, Integer, String, Text, create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_PATH = Path(__file__).parent / "schemas.db"
_POSTGRES_KEYS = ("POSTGRES_HOST", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD")


def _env(environ: Mapping[str, str], key: str) -> str:
    return (environ.get(key) or "").strip()


def resolve_database_url(environ: Mapping[str, str] | None = None) -> str:
    """Resolves to use SQLite for the database by default. Resolves to Postgres when a DATABASE_URL or a full POSTGRES_* set is present.

    Local and App Runner omit those vars. The Helm ConfigMap/Secret set them.
    """
    environ = os.environ if environ is None else environ
    explicit = _env(environ, "DATABASE_URL")
    if explicit:
        return explicit

    parts = {key: _env(environ, key) for key in _POSTGRES_KEYS}
    if any(parts.values()) and not all(parts.values()):
        missing = [key for key, value in parts.items() if not value]
        raise RuntimeError(
            "Incomplete Postgres config; set all of POSTGRES_HOST, POSTGRES_DB, "
            f"POSTGRES_USER, POSTGRES_PASSWORD (missing: {', '.join(missing)})."
        )
    if all(parts.values()):
        port = _env(environ, "POSTGRES_PORT") or "5432"
        user = quote_plus(parts["POSTGRES_USER"])
        password = quote_plus(parts["POSTGRES_PASSWORD"])
        return (
            f"postgresql+psycopg://{user}:{password}@"
            f"{parts['POSTGRES_HOST']}:{port}/{parts['POSTGRES_DB']}"
        )
    return f"sqlite:///{DATABASE_PATH}"


def _create_engine(url: str):
    """Depending on the database URL given (SQLite or Postgres), creates the database engine accordingly.
    If the URL given is not SQLite, it will try to connect for up to 30 seconds before giving up.
    """
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False})

    last_error: Exception | None = None
    for _ in range(30):
        engine = create_engine(url)
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return engine
        except Exception as error:
            last_error = error
            engine.dispose()
            time.sleep(1)
    raise RuntimeError("Postgres did not become ready.") from last_error


DATABASE_URL = resolve_database_url()
engine = _create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class SavedSchema(Base):
    __tablename__ = "saved_schemas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    config = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(bind=engine)
