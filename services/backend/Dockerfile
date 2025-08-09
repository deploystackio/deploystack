# Production image
FROM node:23-alpine

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

# Create persistent_data directory structure
RUN mkdir -p /app/persistent_data

# Create a default .env file
RUN echo "NODE_ENV=production" > .env && \
    echo "PORT=3000" >> .env

EXPOSE 3000
CMD ["node", "--env-file=.env", "dist/index.js"]
