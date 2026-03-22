#!/usr/bin/env bash
# GyanGrit — Render build script
# Called by Render as the Build Command for the gyangrit-backend Web Service.
# Runs once per deploy. Exits non-zero on any failure (set -e).

set -e

echo "=== GyanGrit Backend Build ==="
echo "Python: $(python3 --version)"
echo "Pip:    $(pip --version)"

echo ""
echo "--- Installing production dependencies ---"
pip install -r requirements/prod.txt

echo ""
echo "--- Collecting static files ---"
python manage.py collectstatic --no-input

echo ""
echo "--- Running database migrations ---"
python manage.py migrate --no-input

echo ""
echo "=== Build complete ==="
