FROM nginx:alpine

# Only copy the MVP frontend files — nothing else from the repo root
COPY demo.html  /usr/share/nginx/html/
COPY admin.html /usr/share/nginx/html/
COPY demo.js    /usr/share/nginx/html/
COPY admin.js   /usr/share/nginx/html/
COPY i18n.js    /usr/share/nginx/html/

EXPOSE 80
