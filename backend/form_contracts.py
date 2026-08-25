"""Typed contract for the LLM's chat replies.

The system prompt tells the model to answer with a single JSON object; these
models parse it so that type errors (min/max that must be strings, counts that
must be integers or null) fail loudly instead of surfacing as silent `.get()`
defaults in the endpoint.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class Descriptor(BaseModel):
    # No min_length on name: an empty name is a *gate* error (retried by the
    # LLM), not a 502 — the contract stays permissive, form_validation is strict.
    name: str = Field(max_length=120)
    min: str
    max: str
    units: str = ""


class Ingredient(Descriptor):
    required: bool = False


class FormulationGroup(BaseModel):
    name: str = Field(max_length=120)
    min: str
    max: str
    min_ingredients: Optional[int] = None
    max_ingredients: Optional[int] = None
    ingredients: list[Ingredient]


class FormUpdates(BaseModel):
    general_inputs: list[Descriptor] | None = None
    formulation_groups: list[FormulationGroup] | None = None
    outputs: list[Descriptor] | None = None
    num_rows: int | None = None
    noise: float | None = None
    filename: str | None = None
    min_ingredients_per_formulation: int | None = None
    max_ingredients_per_formulation: int | None = None

    def is_empty(self) -> bool:
        return all(
            value is None
            for value in (
                self.general_inputs,
                self.formulation_groups,
                self.outputs,
                self.num_rows,
                self.noise,
                self.filename,
                self.min_ingredients_per_formulation,
                self.max_ingredients_per_formulation,
            )
        )


class ChatReply(BaseModel):
    message: str
    form_changes_intended: bool = False
    form_updates: FormUpdates | None = None
