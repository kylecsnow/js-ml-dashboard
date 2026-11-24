#!/usr/bin/env bash

status=0

echo 'Running `black .`'
if ! black .; then
    >&2 echo "failed black"
    status=1
fi

echo '

===============================================

'

echo 'Running `ruff check .`'
if ! ruff check .; then
    >&2 echo "failed ruff check"
    status=1
fi

echo '

===============================================

'

echo 'Running `mypy --strict .`'
if ! mypy --strict .; then
    >&2 echo "failed mypy"
    status=1
fi

echo '

===============================================

'

echo 'Running `pytest --cov=./backend --cov-report=term-missing`'
if ! pytest --cov=./backend --cov-report=term-missing; then
    >&2 echo "failed pytest"
    status=1
fi

echo '

===============================================

'

if [[ "$status" != "0" ]]; then
    >&2 echo "one or more checks failed"
    exit "$status"
fi
