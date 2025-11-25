#!/bin/bash

CONTAINER_NAME="postgres-local"
POSTGRES_VERSION="18"
POSTGRES_PASSWORD="deploystack"
POSTGRES_USER="deploystack"
POSTGRES_DB="deploystack"
HOST_PORT="5432"

# Pull the PostgreSQL 18 image
echo "Pulling PostgreSQL ${POSTGRES_VERSION}..."
docker pull postgres:${POSTGRES_VERSION}

# Stop and remove existing container if it exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Stopping and removing existing container..."
    docker stop ${CONTAINER_NAME} 2>/dev/null
    docker rm ${CONTAINER_NAME} 2>/dev/null
fi

# Start PostgreSQL container
echo "Starting PostgreSQL ${POSTGRES_VERSION}..."
docker run -d \
    --name ${CONTAINER_NAME} \
    -e POSTGRES_PASSWORD=${POSTGRES_PASSWORD} \
    -e POSTGRES_USER=${POSTGRES_USER} \
    -e POSTGRES_DB=${POSTGRES_DB} \
    -p ${HOST_PORT}:5432 \
    -v postgres_data:/var/lib/postgresql/data \
    postgres:${POSTGRES_VERSION}

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 3

# Check if container is running
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo ""
    echo "PostgreSQL ${POSTGRES_VERSION} is running!"
    echo "Connection details:"
    echo "  Host: localhost"
    echo "  Port: ${HOST_PORT}"
    echo "  User: ${POSTGRES_USER}"
    echo "  Password: ${POSTGRES_PASSWORD}"
    echo "  Database: ${POSTGRES_DB}"
    echo ""
    echo "Connect with: psql -h localhost -U ${POSTGRES_USER} -d ${POSTGRES_DB}"
else
    echo "Failed to start PostgreSQL. Check logs with: docker logs ${CONTAINER_NAME}"
    exit 1
fi