#!/bin/bash
set -e

# If running as root, fix permissions before dropping privileges
if [ "$(id -u)" = "0" ]; then
  # Fix persistent_data directory permissions for Docker volume
  if [ -d "/app/persistent_data" ]; then
    echo "Fixing persistent_data directory permissions for deploystack user..."
    chown -R deploystack:deploystack /app/persistent_data
    chmod 755 /app/persistent_data
    echo "✓ Persistent data permissions fixed"
  fi

  # Ensure all /app files are owned by deploystack user
  # This fixes any files that were created as root during build
  echo "Ensuring /app files are owned by deploystack user..."
  chown -R deploystack:deploystack /app
  echo "✓ App files permissions fixed"

  # Drop privileges to deploystack user and execute command
  echo "Starting satellite as deploystack user..."
  exec gosu deploystack "$@"
else
  # Already running as non-root user, just execute
  exec "$@"
fi
