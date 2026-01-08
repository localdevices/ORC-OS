#!/bin/bash
set -e

# Initialize/migrate the database
cd /app/orc_api
alembic upgrade head
cd /app

# Start the application
exec uvicorn orc_api.main:app --host 0.0.0.0 --port 5000 --timeout-keep-alive 120
