# Production image - Debian base required for nsjail
FROM node:24-bookworm-slim

# Install nsjail for stdio MCP server process isolation
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    nsjail \
    && rm -rf /var/lib/apt/lists/*

# Enable unprivileged user namespaces (required for nsjail)
RUN echo "kernel.unprivileged_userns_clone=1" > /etc/sysctl.d/00-local-userns.conf

WORKDIR /app

# Copy package files
COPY services/satellite/package.json ./

# Install ONLY production dependencies
RUN npm install --omit=dev --no-package-lock

# Copy pre-built files
COPY services/satellite/dist ./dist

# Create a default .env file with production defaults
RUN echo "NODE_ENV=production" > .env && \
    echo "PORT=3001" >> .env && \
    echo "LOG_LEVEL=info" >> .env

EXPOSE 3001

# Run as non-root user for security
USER node

CMD ["node", "--env-file=.env", "dist/index.js"]
