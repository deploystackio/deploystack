# Development/Team-Only image - simplified without nsjail
# For production multi-tenant deployment, see docs for nsjail setup
FROM node:24-bookworm-slim

# Create deploystack user with home directory
RUN useradd -m -d /opt/deploystack -s /bin/bash deploystack

# Install only essential runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create mcp-cache base directory with proper ownership
RUN mkdir -p /opt/deploystack/mcp-cache && \
    chown -R deploystack:deploystack /opt/deploystack

WORKDIR /app

# Copy package files
COPY services/satellite/package.json ./

# Install ONLY production dependencies
RUN npm install --omit=dev --no-package-lock

# Copy pre-built files
COPY services/satellite/dist ./dist

# Create a default .env file with development defaults
# NODE_ENV=development ensures no nsjail isolation is used
RUN echo "NODE_ENV=development" > .env && \
    echo "PORT=3001" >> .env && \
    echo "LOG_LEVEL=info" >> .env

EXPOSE 3001

# Run as deploystack user
USER deploystack

CMD ["node", "--env-file=.env", "dist/index.js"]
