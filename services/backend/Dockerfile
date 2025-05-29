# Production image
FROM node:23-alpine

ARG DEPLOYSTACK_BACKEND_VERSION
WORKDIR /app

# Copy package files
COPY services/backend/package.json ./

# Install ONLY production dependencies (much faster than a full install)
RUN npm install --omit=dev --no-package-lock

# Copy pre-built files
COPY services/backend/dist ./dist

# Create the shared directory structure
RUN mkdir -p /shared/public/img/
COPY services/shared/public/img/favicon.ico /shared/public/img/

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Create a default .env file
RUN echo "NODE_ENV=production" > .env && \
    echo "PORT=3000" >> .env && \
    echo "DEPLOYSTACK_BACKEND_VERSION=${DEPLOYSTACK_BACKEND_VERSION:-$(node -e "console.log(require('./package.json').version)")}" >> .env

EXPOSE 3000
CMD ["node", "--env-file=.env", "dist/index.js"]
