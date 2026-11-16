#!/bin/bash
# Entrypoint script for production container

set -e

echo "Starting DB Sentinel agent-engine..."

# Wait for database to be ready
echo "Waiting for database..."
until pg_isready -h "${POSTGRES_HOST:-postgres}" -U "${POSTGRES_USER:-db_sentinel}" -d "${POSTGRES_DB:-db_sentinel}"; do
    echo "Database not ready, waiting..."
    sleep 2
done

echo "Database is ready!"

# Run database migrations
echo "Running database migrations..."
alembic upgrade head

echo "Migrations completed!"

# Start the application
echo "Starting application..."
exec "$@"