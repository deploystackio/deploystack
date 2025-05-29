#!/bin/sh

# Generate runtime environment variables for Docker production environment
echo "// Runtime environment variables - auto-generated" > /usr/share/nginx/html/runtime-env.js
echo "window.RUNTIME_ENV = {" >> /usr/share/nginx/html/runtime-env.js

# Add all VITE_ variables (these are what Vue/Vite normally processes)
env | grep -E '^VITE_' | sort | while read -r line; do
  key=$(echo $line | cut -d= -f1)
  value=$(echo $line | cut -d= -f2-)
  echo "  \"$key\": \"$(echo $value | sed 's/"/\\"/g')\"," >> /usr/share/nginx/html/runtime-env.js
done

# Add any specific non-VITE_ variables you want to expose
for var in FOO BAR BAZ; do
  if [ ! -z "$(eval echo \$$var)" ]; then
    echo "  \"$var\": \"$(eval echo \$$var | sed 's/"/\\"/g')\"," >> /usr/share/nginx/html/runtime-env.js
  fi
done

# Close the object
echo "};" >> /usr/share/nginx/html/runtime-env.js

# Start nginx
exec nginx -g "daemon off;"
