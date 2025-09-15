# Production image
FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY services/satellite/package.json ./

# Install ONLY production dependencies (much faster than a full install)
RUN npm install --omit=dev --no-package-lock

# Copy pre-built files
COPY services/satellite/dist ./dist

# Create a default .env file with production defaults
RUN echo "NODE_ENV=production" > .env && \
    echo "PORT=3001" >> .env && \
    echo "LOG_LEVEL=info" >> .env

EXPOSE 3001
CMD ["node", "--env-file=.env", "dist/index.js"]
