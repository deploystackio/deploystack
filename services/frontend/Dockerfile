# Simple production image with nginx
FROM nginx:stable-alpine

# Copy the built frontend app
COPY services/frontend/dist /usr/share/nginx/html
COPY services/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Add version info
ARG DEPLOYSTACK_FRONTEND_VERSION
RUN echo "{\"version\":\"${DEPLOYSTACK_FRONTEND_VERSION}\"}" > /usr/share/nginx/html/version.json

# Copy environment config generator script
COPY services/frontend/env-config.sh /env-config.sh
RUN chmod +x /env-config.sh

# Modify index.html to include runtime-env.js
RUN sed -i '/<head>/a \    <script src="/runtime-env.js"></script>' /usr/share/nginx/html/index.html

EXPOSE 80
CMD ["/env-config.sh"]
