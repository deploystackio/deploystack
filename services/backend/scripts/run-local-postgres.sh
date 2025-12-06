#!/bin/bash

CONTAINER_NAME="deploystack-postgres-local"
POSTGRES_PASSWORD="deploystack"
POSTGRES_USER="deploystack"
POSTGRES_DB="deploystack"
HOST_PORT="5432"

# Stop and remove existing container if it exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Stopping and removing existing container..."
    docker stop ${CONTAINER_NAME} 2>/dev/null
    docker rm ${CONTAINER_NAME} 2>/dev/null
fi

# Start PostgreSQL container (same config as docker-compose.yml)
echo "Starting PostgreSQL 18..."
docker run -d \
    --name ${CONTAINER_NAME} \
    -e POSTGRES_DB=${POSTGRES_DB} \
    -e POSTGRES_USER=${POSTGRES_USER} \
    -e POSTGRES_PASSWORD=${POSTGRES_PASSWORD} \
    -p ${HOST_PORT}:5432 \
    -v deploystack_postgres_data:/var/lib/postgresql/data \
    postgres:18-alpine

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker exec ${CONTAINER_NAME} pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB} >/dev/null 2>&1; then
        echo ""
        echo "PostgreSQL 18 is running!"
        echo ""
        echo "Connection details:"
        echo "  Host: localhost"
        echo "  Port: ${HOST_PORT}"
        echo "  User: ${POSTGRES_USER}"
        echo "  Password: ${POSTGRES_PASSWORD}"
        echo "  Database: ${POSTGRES_DB}"
        echo ""
        echo "Connect with: psql -h localhost -U ${POSTGRES_USER} -d ${POSTGRES_DB}"
        exit 0
    fi
    sleep 1
done

echo "Failed to start PostgreSQL. Check logs with: docker logs ${CONTAINER_NAME}"
exit 1