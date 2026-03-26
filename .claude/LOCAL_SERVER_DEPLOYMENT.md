# GyanGrit — Local Server Deployment (ASUS ROG)

> Deploy GyanGrit on a local machine (ASUS ROG laptop or any Ubuntu box)
> as a self-hosted server for schools with unreliable internet.

---

## Why self-host?

Render's free tier has cold starts (30-60s), is in Singapore (200ms RTT from
Punjab), and shuts down after 15 min of inactivity. A local server in the
school eliminates all three problems: instant response, zero latency on LAN,
and always-on during school hours.

---

## Prerequisites

| Item | Requirement |
|------|-------------|
| Machine | Any x86_64 laptop/desktop with 8GB+ RAM (ASUS ROG, etc.) |
| OS | Ubuntu Server 24.04 LTS (or Ubuntu Desktop with server services) |
| Network | School LAN with a router you can configure |
| Domain | Optional — needed only for HTTPS from outside the LAN |
| Power | UPS recommended — server should survive brief outages |

---

## 1. Install Ubuntu Server

1. Download Ubuntu Server 24.04 LTS from https://ubuntu.com/download/server
2. Flash to USB with Balena Etcher or `dd`
3. Boot the ROG from USB (press F2/ESC for BIOS → boot menu)
4. Install with defaults. Create user `gyangrit`. Enable OpenSSH server.
5. After install, update:
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y git curl wget ufw
   ```

---

## 2. Install Docker & Docker Compose

```bash
# Docker official install
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

---

## 3. Clone the repo

```bash
cd /home/gyangrit
git clone https://github.com/YOUR_USERNAME/GyanGrit.git
cd GyanGrit
```

---

## 4. Create `.env` for production

```bash
cp backend/.env backend/.env.local
nano backend/.env.local
```

Set these values:

```env
# Core
SECRET_KEY=generate-a-random-50-char-string-here
DEBUG=False
ALLOWED_HOSTS=localhost,192.168.1.100,gyangrit.local
CORS_ALLOWED_ORIGINS=http://192.168.1.100,http://gyangrit.local

# Database — local PostgreSQL (not Supabase)
DATABASE_URL=postgres://gyangrit:your_db_password@db:5432/gyangrit

# Session cookies — SameSite=Lax for same-origin (not cross-origin like Render+Vercel)
SESSION_COOKIE_SAMESITE=Lax
CSRF_COOKIE_SAMESITE=Lax
SESSION_COOKIE_SECURE=False
CSRF_COOKIE_SECURE=False

# No HTTPS redirect on LAN
SECURE_SSL_REDIRECT=False

# LiveKit (use your cloud account or self-host LiveKit)
LIVEKIT_URL=wss://your-livekit-instance.livekit.cloud
LIVEKIT_API_KEY=your_key
LIVEKIT_API_SECRET=your_secret

# Ably
ABLY_API_KEY=your_ably_key

# Gemini
GEMINI_API_KEY=your_gemini_key

# VAPID (push notifications)
VAPID_PRIVATE_KEY=your_private_key
VAPID_PUBLIC_KEY=your_public_key
```

Generate a secret key:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

---

## 5. Docker Compose file

Create `docker-compose.yml` in the project root:

```yaml
version: "3.9"

services:
  db:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: gyangrit
      POSTGRES_USER: gyangrit
      POSTGRES_PASSWORD: your_db_password
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gyangrit"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    depends_on:
      db:
        condition: service_healthy
    env_file: ./backend/.env.local
    environment:
      DJANGO_SETTINGS_MODULE: gyangrit.settings.prod
    ports:
      - "8000:8000"
    command: >
      sh -c "python manage.py migrate --noinput &&
             python manage.py collectstatic --noinput &&
             gunicorn gyangrit.wsgi:application -c gunicorn.conf.py"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: always
    ports:
      - "3000:80"

  nginx:
    image: nginx:alpine
    restart: always
    depends_on:
      - backend
      - frontend
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health/"]
      interval: 30s
      timeout: 5s

volumes:
  pgdata:
```

---

## 6. Backend Dockerfile

Create `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements/base.txt requirements/base.txt
COPY requirements/prod.txt requirements/prod.txt
RUN pip install --no-cache-dir -r requirements/prod.txt

COPY . .

RUN python manage.py collectstatic --noinput || true

EXPOSE 8000
```

---

## 7. Frontend Dockerfile

Create `frontend/Dockerfile`:

```dockerfile
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Point API to the local backend (same origin via nginx)
ENV VITE_API_BASE_URL=/api/v1
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx-frontend.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

Create `frontend/nginx-frontend.conf`:

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA — all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 8. Nginx reverse proxy config

Create `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:8000;
    }
    upstream frontend {
        server frontend:80;
    }

    server {
        listen 80;
        server_name gyangrit.local 192.168.1.100 localhost;

        client_max_body_size 50M;

        # API → Django backend
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 120s;
        }

        # Django admin
        location /admin/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # Static files (Django)
        location /static/ {
            proxy_pass http://backend;
        }

        # Health check
        location /health/ {
            proxy_pass http://backend/api/v1/health/;
        }

        # Everything else → React frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
        }
    }
}
```

---

## 9. Start everything

```bash
cd /home/gyangrit/GyanGrit

# Create nginx directory
mkdir -p nginx/certs

# Build and start
docker compose up -d --build

# Check logs
docker compose logs -f backend
docker compose logs -f nginx

# Create superuser
docker compose exec backend python manage.py createsuperuser
```

Visit `http://192.168.1.100` from any device on the school LAN.

---

## 10. Set up local DNS (optional)

So students can type `gyangrit.local` instead of an IP address.

**Option A: Router DNS** — Most routers have a "Static DNS" or "Local DNS"
setting. Add `gyangrit.local → 192.168.1.100`.

**Option B: mDNS (Avahi)** — Ubuntu already has Avahi. The server is
automatically reachable at `gyangrit-rog.local` (or whatever the hostname is).
To use a custom name:

```bash
sudo hostnamectl set-hostname gyangrit
# Now accessible at gyangrit.local on the LAN
```

---

## 11. HTTPS with Let's Encrypt (for external access)

Only needed if you want students to access from outside the school (e.g., from
home). Requires a public domain and port forwarding.

### Prerequisites
- Domain pointing to your public IP (e.g., `school.gyangrit.site`)
- Router port forwarding: 80 → 192.168.1.100:80, 443 → 192.168.1.100:443

### Install Certbot

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d school.gyangrit.site
```

Copy certs to the nginx volume:
```bash
sudo cp /etc/letsencrypt/live/school.gyangrit.site/fullchain.pem nginx/certs/
sudo cp /etc/letsencrypt/live/school.gyangrit.site/privkey.pem nginx/certs/
```

Update `nginx.conf` to add an HTTPS server block:

```nginx
server {
    listen 443 ssl;
    server_name school.gyangrit.site;

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    # ... same location blocks as above ...
}

server {
    listen 80;
    server_name school.gyangrit.site;
    return 301 https://$host$request_uri;
}
```

### Auto-renew certs

```bash
sudo crontab -e
# Add:
0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/school.gyangrit.site/*.pem /home/gyangrit/GyanGrit/nginx/certs/ && docker compose -f /home/gyangrit/GyanGrit/docker-compose.yml restart nginx
```

---

## 12. Dynamic DNS (for changing public IPs)

Most home/school ISPs assign dynamic IPs. Use a DDNS service so your domain
always points to the current IP.

**Free options:**
- **DuckDNS** (https://duckdns.org) — free, simple, cron-based
- **No-IP** (https://noip.com) — free tier with monthly confirmation
- **Cloudflare DDNS** — if your domain is on Cloudflare, use a script

### DuckDNS example

```bash
# Add to crontab
*/5 * * * * curl -s "https://www.duckdns.org/update?domains=gyangrit&token=YOUR_TOKEN&ip=" > /dev/null
```

---

## 13. Auto-start on boot

Docker containers with `restart: always` will auto-start after reboot. But
ensure Docker itself starts:

```bash
sudo systemctl enable docker
```

---

## 14. Backup the database

```bash
# Manual backup
docker compose exec db pg_dump -U gyangrit gyangrit > backup_$(date +%Y%m%d).sql

# Auto backup (add to crontab)
0 2 * * * cd /home/gyangrit/GyanGrit && docker compose exec -T db pg_dump -U gyangrit gyangrit > backups/backup_$(date +\%Y\%m\%d).sql
```

Create the backups directory:
```bash
mkdir -p /home/gyangrit/GyanGrit/backups
```

---

## 15. Firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS (if using SSL)
sudo ufw enable
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Can't access from other devices | Check firewall: `sudo ufw status`. Check IP: `ip addr show`. |
| Database connection refused | `docker compose logs db` — check if Postgres is healthy. |
| Backend 500 errors | `docker compose logs backend` — check for missing env vars. |
| Slow first load | Normal — first request after idle warms up Django. Not an issue with local server. |
| Students can't find server | Give them the IP address or set up local DNS (step 10). |
| Certs expired | Run `sudo certbot renew` and restart nginx. |

---

## Architecture (local vs cloud)

```
┌─ Cloud (current) ─────────────────────────┐
│  Vercel (frontend) ←→ Render (backend)     │
│  Singapore region    Singapore region       │
│  ~200ms RTT from Punjab                    │
└────────────────────────────────────────────┘

┌─ Local (this guide) ──────────────────────┐
│  Nginx (port 80/443)                       │
│    ├── /api/*  → Django backend (port 8000)│
│    └── /*      → React frontend (port 3000)│
│  PostgreSQL (port 5432)                    │
│  All on one machine, <1ms LAN latency      │
└────────────────────────────────────────────┘
```
