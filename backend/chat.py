import json
import logging
import os
from typing import Any

from fastapi import APIRouter, Body, HTTPException
from openai import OpenAI

logger = logging.getLogger(__name__)

router = APIRouter()

DATASET_GENERATOR_CHAT_SYSTEM_PROMPT = """\
You are an expert assistant that helps scientists and engineers set up synthetic \
datasets for formulation-based chemistry and materials science ML problems.

You are embedded in a web application that has a "Dataset Generator" form. The form \
has the following sections:

1. **General Inputs** — continuous process variables (e.g. temperature, time, speed). \
   Each has: name, min, max, units.
2. **Formulation Inputs** — mixture/recipe ingredients whose fractions must sum to 1. \
   Each has: name, min (≥0, ≤1), max (≥0, ≤1). No units field (fractions implied). \
   There are also optional "min_ingredients_per_formulation" and \
   "max_ingredients_per_formulation" integers that control how many ingredients are \
   active (non-zero) per row.
3. **Outputs** — the response variables the ML model will predict / optimize. \
   Each has: name, min, max, units.
4. **Metadata** — num_rows (int), noise (float, default 0.025), \
   filename (string ending in .csv).

### Rules you MUST follow:
- Formulation input min and max values MUST be between 0 and 1 (they represent \
  weight/volume fractions).
- When the user asks you to ADD an item to a category, return the FULL list for that \
  category (existing items + the new one). Do NOT return only the delta.
- When the user asks you to REMOVE an item, return the full list minus that item.
- When the user asks you to MODIFY an item, return the full list with the modification.
- Only include a category key in form_updates when it should change. Omit categories \
  that should stay the same.
- If the user is just asking a question or for advice (not requesting form changes), \
  respond conversationally and do NOT include form_updates.
- Use your chemistry/materials science knowledge to suggest realistic variable names, \
  ranges, and units.
- Be concise but informative in your message.

### Response format:
You MUST respond with valid JSON matching this schema exactly:
{
  "message": "<your conversational reply to the user>",
  "form_updates": {                // OPTIONAL — omit entirely if no form changes
    "general_inputs": [            // optional
      {"name": "...", "min": "...", "max": "...", "units": "..."}
    ],
    "formulation_inputs": [        // optional
      {"name": "...", "min": "...", "max": "..."}
    ],
    "outputs": [                   // optional
      {"name": "...", "min": "...", "max": "...", "units": "..."}
    ],
    "num_rows": 50,                // optional (integer)
    "noise": 0.025,                // optional (float)
    "filename": "my_dataset.csv",  // optional (string)
    "min_ingredients_per_formulation": 3,  // optional (integer or null)
    "max_ingredients_per_formulation": 4   // optional (integer or null)
  }
}

All min/max values in the arrays MUST be strings (they are displayed in text inputs). \
num_rows, noise, min_ingredients_per_formulation, and max_ingredients_per_formulation \
should be numbers (or null).
"""


@router.post("/api/chat/dataset-generator")
async def chat_dataset_generator(body: dict = Body(...)) -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY environment variable is not set.",
        )

    user_message: str = body.get("message", "")
    conversation_history: list = body.get("conversation_history", [])
    form_state: dict = body.get("form_state", {})

    if not user_message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    current_state_block = (
        "\n\n### Current form state:\n```json\n"
        + json.dumps(form_state, indent=2)
        + "\n```"
    )

    messages = [
        {"role": "system", "content": DATASET_GENERATOR_CHAT_SYSTEM_PROMPT + current_state_block},
    ]
    for entry in conversation_history:
        messages.append({"role": entry["role"], "content": entry["content"]})
    messages.append({"role": "user", "content": user_message})

    try:
        client = OpenAI(api_key=api_key)
        completion = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.4,
        )

        raw = completion.choices[0].message.content
        parsed = json.loads(raw)

        response_message = parsed.get("message", "")
        form_updates = parsed.get("form_updates", None)

        result: dict[str, Any] = {"message": response_message}
        if form_updates is not None:
            result["form_updates"] = form_updates

        return result

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail="The LLM returned an invalid JSON response. Please try again.",
        )
    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
