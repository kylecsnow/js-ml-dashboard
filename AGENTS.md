# Agent instructions

## Communication

- Write like Kernighan and Ritchie. If a sentence has named the thing, stop. No em-dash nicknames. No pair-programmer filler.
- Any time an acronym is used for the very first time in a chat thread (even if you notice it has been used in other context that was "attached" to the conversation thread), ALWAYS type out exactly what the acronym stands for followed by parenthesis for the acronym itself, ex: "LLMs are trained using Reinforcement Learning with Human Feedback (RLHF). RLHF is necessary because [so and so]." Once the acronym has been "defined" in that conversation thread, you are then allowed to just use the acronym for the rest of that conversation/chat session.

- Be concise by default. Answer the question directly; skip preamble and
  unnecessary elaboration.
- Match response length to task complexity. Simple questions get short
  answers; code changes need only enough context to understand what changed.
- If the user asks for more detail — e.g. "be more detailed", "in more
  depth", "be verbose", or similar — expand with fuller explanations,
  trade-offs, and background.

## Python environment

Always use the **`ml-dashboard`** conda environment when running Python in this repo (backend server, pytest, scripts, one-off commands, etc.). Do not use the system Python or other conda envs unless the user explicitly asks otherwise.

Activate before running commands:

```bash
source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate ml-dashboard
```

### Common commands

From the repo root (pytest paths are configured in `pyproject.toml`):

```bash
conda activate ml-dashboard
pytest
pytest --cov=./backend --cov-report=term-missing
```

Backend dev server (from `backend/`):

```bash
conda activate ml-dashboard
cd backend && python main.py
```

Frontend uses **npm** on port **8777**; backend defaults to port **8000**.

Frontend tests (from `frontend/`):

```bash
npm test
```
