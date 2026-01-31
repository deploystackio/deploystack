# Development/Team-Only image - simplified without nsjail
# For production multi-tenant deployment, see docs for nsjail setup
FROM node:24-bookworm-slim

# Create deploystack user with home directory
RUN useradd -m -d /opt/deploystack -s /bin/bash deploystack

# Install essential runtime dependencies including gosu for privilege dropping
# Python 3 and UV are required for Python-based MCP servers
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    gosu \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install UV (Python package manager for MCP servers)
# Using pip installation for reliable system-wide access
# This installs both 'uv' and 'uvx' commands to /usr/local/bin
RUN pip3 install --break-system-packages uv && \
    which uv && \
    which uvx && \
    uv --version

# Install TypeScript globally for GitHub deployment builds
# Available at /usr/local/bin/tsc for all Node.js MCP servers
RUN npm install -g typescript && \
    tsc --version

# Create mcp-cache base directory with proper ownership
RUN mkdir -p /opt/deploystack/mcp-cache && \
    chown -R deploystack:deploystack /opt/deploystack

# Create GitHub deployment base directory for production tmpfs mounts
# Required when NODE_ENV=production and platform=linux
RUN mkdir -p /opt/mcp-deployments && \
    chown deploystack:deploystack /opt/mcp-deployments && \
    chmod 755 /opt/mcp-deployments

WORKDIR /app

# Create persistent_data directory with proper ownership
# This prevents Docker volume permission issues when running as non-root user
RUN mkdir -p /app/persistent_data && \
    chown -R deploystack:deploystack /app/persistent_data && \
    chmod 755 /app/persistent_data

# Copy package files
COPY services/satellite/package.json ./

# Install ONLY production dependencies
RUN npm install --omit=dev --no-package-lock

# Copy pre-built files
COPY services/satellite/dist ./dist

# Copy entrypoint script
COPY services/satellite/scripts/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create a default .env file with development defaults
# NODE_ENV=development ensures no nsjail isolation is used
RUN echo "NODE_ENV=development" > .env && \
    echo "PORT=3001" >> .env && \
    echo "LOG_LEVEL=info" >> .env

EXPOSE 3001

# Use entrypoint script that fixes permissions and drops privileges
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "--env-file=.env", "dist/index.js"]
