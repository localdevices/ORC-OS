#!/bin/bash
set -e

# Install the package in editable mode if not already installed
# This ensures code changes in the mounted volume are picked up
if [ -f /app/pyproject.toml ] && ! pip show orc_api > /dev/null 2>&1; then
  echo "Installing ORC-OS in editable mode..."
  pip install -e . --quiet
fi

# Compile Numba JIT on first run (takes several minutes)
# Subsequent runs will use the cached compilation
if [ ! -f /app/data/.jit_compiled ]; then
  echo "Compiling Numba JIT (first run, this may take a few minutes)..."
  mkdir -p /app/data
  orc --help > /dev/null
  # ensure it is clear the compilation has taken place successfully
  touch /app/data/.jit_compiled
fi

# Initialize/migrate the database
orc db migrate
# if a password is selected by user, then set it in the database
if [ -n "$ORC_PASSWORD" ]; then
  FLAG_FILE="/app/data/.password_initialized"
  if [ ! -f "$FLAG_FILE" ]; then
    echo "Setting password from environment variable (first run)."
    orc password set --new_password "$ORC_PASSWORD"
    mkdir -p /app/data
    touch "$FLAG_FILE"
  else
    echo "Password already initialized, skipping."
  fi
fi

# Start the application within Dockerfile
exec "$@"
