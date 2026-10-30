# ─────────────────────────────────────────────────────────────────────────────
# MusicMatch Frontend — Dockerfile
# Serves the static frontend via Nginx.
# ─────────────────────────────────────────────────────────────────────────────

FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/musicmatch.conf

# Copy all frontend static files
COPY . /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost/index.html || exit 1

CMD ["nginx", "-g", "daemon off;"]
