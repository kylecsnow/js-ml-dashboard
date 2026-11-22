#!/usr/bin/env bash

echo 'Running `black .`'
black .

echo '

===============================================

'

echo 'Running `ruff check .`'
ruff check .
ruff_exit_code=$?
if [[ "$ruff_exit_code" != "0" ]]; then
    >&2 echo "failed ruff check"
    exit "$ruff_exit_code"
fi

echo '

===============================================

'

echo 'Running `mypy --strict .`'
mypy --strict .
mypy_exit_code=$?
if [[ "$mypy_exit_code" != "0" ]]; then
    >&2 echo "failed mypy"
    exit "$mypy_exit_code"
fi

echo '

===============================================

'

# echo 'Running `pytest`'
# pytest
# pytest_exit_code=$?
# if [[ "$pytest_exit_code" != "0" ]]; then
#     >&2 echo "failed pytest"
#     exit "$pytest_exit_code"
# fi

# echo '

# ===============================================

# '