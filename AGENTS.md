# Agent instructions

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

Frontend uses **pnpm** on port **8777**; backend defaults to port **8000**.
