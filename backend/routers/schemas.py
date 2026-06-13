import json
import logging

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import SessionLocal, SavedSchema

logger = logging.getLogger(__name__)

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/api/schemas")
async def list_schemas(db: Session = Depends(get_db)) -> dict:
    schemas = db.query(SavedSchema).order_by(SavedSchema.created_at.desc()).all()
    return {
        "schemas": [
            {
                "id": s.id,
                "name": s.name,
                "config": json.loads(s.config),
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in schemas
        ]
    }


@router.post("/api/schemas", status_code=status.HTTP_201_CREATED)
async def create_schema(body: dict = Body(...), db: Session = Depends(get_db)) -> dict:
    """Create a saved schema. `config` is opaque JSON; it may include coefficientValues."""
    name = body.get("name")
    config = body.get("config")

    if not name or not name.strip():
        raise HTTPException(status_code=400, detail="Schema name is required.")
    if config is None:
        raise HTTPException(status_code=400, detail="Schema config is required.")

    schema = SavedSchema(name=name.strip(), config=json.dumps(config))
    db.add(schema)
    db.commit()
    db.refresh(schema)

    return {
        "id": schema.id,
        "name": schema.name,
        "created_at": schema.created_at.isoformat() if schema.created_at else None,
    }


@router.patch("/api/schemas/{schema_id}")
async def rename_schema(
    schema_id: int, body: dict = Body(...), db: Session = Depends(get_db)
) -> dict:
    name = body.get("name")
    if not name or not name.strip():
        raise HTTPException(status_code=400, detail="Schema name is required.")

    schema = db.query(SavedSchema).filter(SavedSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found.")

    schema.name = name.strip()
    db.commit()
    db.refresh(schema)

    return {
        "id": schema.id,
        "name": schema.name,
        "created_at": schema.created_at.isoformat() if schema.created_at else None,
    }


@router.delete("/api/schemas/{schema_id}")
async def delete_schema(schema_id: int, db: Session = Depends(get_db)) -> dict[str, str]:
    schema = db.query(SavedSchema).filter(SavedSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found.")
    db.delete(schema)
    db.commit()
    return {"detail": "Schema deleted."}
