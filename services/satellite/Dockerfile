# Production image - Debian base required for nsjail
FROM node:24-bookworm-slim

# Install build dependencies and runtime dependencies for nsjail
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    autoconf \
    bison \
    flex \
    gcc \
    g++ \
    git \
    libprotobuf-dev \
    libnl-route-3-dev \
    libtool \
    make \
    pkg-config \
    protobuf-compiler \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Build nsjail from source
RUN git clone --depth 1 https://github.com/google/nsjail.git /tmp/nsjail && \
    cd /tmp/nsjail && \
    make && \
    cp nsjail /usr/local/bin/ && \
    chmod +x /usr/local/bin/nsjail && \
    cd / && \
    rm -rf /tmp/nsjail

# Clean up build dependencies to reduce image size
# Note: For nsjail to work with unprivileged user namespaces, the HOST system must have:
# kernel.unprivileged_userns_clone=1
# This cannot be set from inside the container. See README for deployment instructions.
RUN apt-get remove -y \
    autoconf \
    bison \
    flex \
    gcc \
    g++ \
    git \
    libtool \
    make \
    pkg-config && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

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
