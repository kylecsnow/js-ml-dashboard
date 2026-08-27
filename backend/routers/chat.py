from fastapi import APIRouter, Body, HTTPException
from langsmith import traceable
import os
from typing import Any

from chat.chat_agent import run_dataset_generator_chat

router = APIRouter()


@router.post("/api/chat/dataset-generator")
@traceable(name="dataset-generator-chat")
async def chat_dataset_generator(body: dict = Body(...)) -> dict[str, Any]:
    if not os.environ.get("GROQ_API_KEY"):
        raise HTTPException(
            status_code=500,
            detail="GROQ_API_KEY environment variable is not set.",
        )

    user_message: str = body.get("message", "")
    if not user_message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    return run_dataset_generator_chat(
        user_message,
        body.get("conversation_history", []),
        body.get("form_state", {}),
    )
