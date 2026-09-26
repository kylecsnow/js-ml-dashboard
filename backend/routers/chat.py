from fastapi import APIRouter, Body, HTTPException
from langsmith import traceable
from typing import Any

from chat.chat_agent import chat_api_key_error, run_dataset_generator_chat

router = APIRouter()


@router.post("/api/chat/dataset-generator")
@traceable(name="dataset-generator-chat")
async def chat_dataset_generator(body: dict = Body(...)) -> dict[str, Any]:
    api_key_error = chat_api_key_error()
    if api_key_error:
        raise HTTPException(
            status_code=500,
            detail=api_key_error,
        )

    user_message: str = body.get("message", "")
    if not user_message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    return run_dataset_generator_chat(
        user_message,
        body.get("conversation_history", []),
        body.get("form_state", {}),
    )
