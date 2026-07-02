# nginx/Dockerfile — Reverse proxy + static files para producción
# Build context: raíz del proyecto (.)
FROM nginx:alpine

# Certbot challenge directory
RUN mkdir -p /var/www/certbot

# Static frontend files
COPY demo.html        /usr/share/nginx/html/
COPY reservar.html    /usr/share/nginx/html/
COPY admin.html       /usr/share/nginx/html/
COPY demo.js          /usr/share/nginx/html/
COPY admin.js         /usr/share/nginx/html/
COPY i18n.js          /usr/share/nginx/html/
COPY manifest.json         /usr/share/nginx/html/
COPY manifest-booking.json /usr/share/nginx/html/
COPY setup.html       /usr/share/nginx/html/
COPY admin-panel.url  /usr/share/nginx/html/
COPY codigodecaballeros-panel.desktop /usr/share/nginx/html/
COPY logo-web.png     /usr/share/nginx/html/
COPY logo-192.png     /usr/share/nginx/html/
COPY logo-512.png     /usr/share/nginx/html/
COPY favicon.ico      /usr/share/nginx/html/
COPY favicon-16.png   /usr/share/nginx/html/
COPY favicon-32.png   /usr/share/nginx/html/
COPY favicon-64.png   /usr/share/nginx/html/
COPY logo-startup-192.png /usr/share/nginx/html/
COPY logo-startup-512.png /usr/share/nginx/html/
COPY logo-startup.png     /usr/share/nginx/html/
COPY propio-icon-192.png      /usr/share/nginx/html/
COPY propio-icon-512.png      /usr/share/nginx/html/
COPY propio-icon-180.png      /usr/share/nginx/html/
COPY propio-icon.svg          /usr/share/nginx/html/
COPY propio-logo.svg      /usr/share/nginx/html/
COPY propio-logo-white.svg /usr/share/nginx/html/
COPY pwa-icon-192.png     /usr/share/nginx/html/
COPY pwa-icon-512.png     /usr/share/nginx/html/
COPY sw.js                /usr/share/nginx/html/

# Nginx config
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443
