# GyanGrit — Nginx Configuration for Oracle Cloud Mumbai
#
# File location on server: /etc/nginx/sites-available/gyangrit
# Apply with: sudo nginx -t && sudo systemctl reload nginx
#
# Tuned for:
#   - Oracle A1.Flex (2 OCPU, 12 GB RAM, aarch64)
#   - Upstream: Gunicorn gthread 5 workers × 4 threads on port 8000
#   - TLS: Let's Encrypt via Certbot (auto-managed)
#   - R2 static/media: served directly, never through Django
#   - Vercel frontend on gyangrit.site (separate), API at api.gyangrit.site
#   - Rural India clients: 2G/3G — gzip is critical

# ── Upstream pool ─────────────────────────────────────────────────────────────
# keepalive 20 = up to 20 persistent connections from Nginx to Gunicorn.
# This eliminates TCP handshake overhead on every request.
# Must match or be less than Gunicorn worker_connections (100).
upstream gunicorn {
    server 127.0.0.1:8000;
    keepalive 20;
}

# ── HTTP → HTTPS redirect ─────────────────────────────────────────────────────
server {
    listen 80;
    listen [::]:80;
    server_name api.gyangrit.site 161.118.168.247;

    # Let's Encrypt challenge — must stay HTTP
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# ── HTTPS main server ─────────────────────────────────────────────────────────
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name api.gyangrit.site;

    # ── TLS (managed by Certbot — do not edit these lines manually) ───────────
    ssl_certificate     /etc/letsencrypt/live/api.gyangrit.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.gyangrit.site/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # ── Security headers ──────────────────────────────────────────────────────
    add_header X-Frame-Options           DENY            always;
    add_header X-Content-Type-Options    nosniff         always;
    add_header X-XSS-Protection          "1; mode=block" always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # ── Gzip compression ──────────────────────────────────────────────────────
    # Critical for 2G/3G networks in rural Punjab.
    # JSON API responses compress 60-80%. CSS/JS compresses ~70%.
    gzip              on;
    gzip_vary         on;
    gzip_proxied      any;
    gzip_comp_level   5;           # 1=fastest, 9=best — 5 is the sweet spot
    gzip_min_length   500;         # don't compress tiny responses
    gzip_types
        application/json
        application/javascript
        text/css
        text/plain
        text/xml
        application/xml
        application/x-www-form-urlencoded
        image/svg+xml;

    # ── Buffer tuning ─────────────────────────────────────────────────────────
    # Prevents "upstream sent too big header" errors on large Django responses.
    proxy_buffers          16 16k;
    proxy_buffer_size      32k;
    proxy_busy_buffers_size 64k;

    # ── Timeouts ──────────────────────────────────────────────────────────────
    # 35s > Gunicorn's 30s timeout so Nginx doesn't kill before Gunicorn does.
    # AI chatbot calls Groq (fast ~200ms) so 35s is very conservative.
    proxy_connect_timeout  10s;
    proxy_read_timeout     35s;
    proxy_send_timeout     35s;

    # ── Client upload limits ──────────────────────────────────────────────────
    # 50MB for PDF/video lesson uploads via the media endpoint.
    client_max_body_size   50M;

    # ── Static files — served by WhiteNoise through Django ───────────────────
    # WhiteNoise is faster than Nginx for Django static files because it uses
    # optimal Cache-Control headers + Brotli. Keep this proxied through Django.
    # WhiteNoise sets: Cache-Control: max-age=31536000, immutable
    location /static/ {
        proxy_pass         http://gunicorn;
        proxy_http_version 1.1;
        proxy_set_header   Connection        "";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        # WhiteNoise already adds immutable cache headers — pass them through
        proxy_cache_bypass $http_upgrade;
    }

    # ── API + all other requests ───────────────────────────────────────────────
    location / {
        proxy_pass         http://gunicorn;
        proxy_http_version 1.1;

        # Required for keepalive to upstream (clears hop-by-hop Connection header)
        proxy_set_header   Connection        "";

        # Pass real client info to Django
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # Required for Django's CSRF middleware to trust the forwarded proto
        proxy_set_header   X-Forwarded-Host  $host;
    }

    # ── Health check — fast path (no logging, no upstream delay) ─────────────
    location = /api/v1/health/ {
        proxy_pass         http://gunicorn;
        proxy_http_version 1.1;
        proxy_set_header   Connection "";
        proxy_set_header   Host $host;
        access_log         off;   # don't clutter logs with keep-alive pings
    }

    # ── Logs ──────────────────────────────────────────────────────────────────
    access_log /var/log/nginx/gyangrit_access.log;
    error_log  /var/log/nginx/gyangrit_error.log  warn;
}
