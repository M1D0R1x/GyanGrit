# GyanGrit — Backend Deployment Options (India/Mumbai)

**Goal:** Get the GyanGrit Django backend as close to Mumbai as possible, with
zero or near-zero cost, no cold starts, and reliable uptime for capstone demos.

**Current setup:** Render (Singapore) → Supabase (Mumbai) → Vercel (Mumbai)

The latency problem: Render (Singapore) to Supabase (Mumbai) adds ~80-120ms
per DB query round trip. A login flow with 3-4 DB queries = 400-500ms just in
network time. Moving the backend to Mumbai eliminates this entirely.

---

## Quick Comparison

| Platform | Region | Free Tier | Cold Starts | Credit Card | Best For |
|---|---|---|---|---|---|
| **Render** (current) | Singapore | Yes (sleeps) | 30-60s | No | Quick PaaS |
| **AWS EC2** | Mumbai (ap-south-1) | 12 months free | None | Yes | Production |
| **GCP Cloud Run** | Mumbai | $300/90 days | ~2s | Yes | Serverless |
| **Oracle Cloud** | Hyderabad | Always Free | None | Yes (no charge) | Best free VPS |
| **Koyeb** | Washington DC | Yes (no sleep) | None | No | Quick PaaS |
| **Fly.io** | Chennai (mad) | Requires payment | None | Yes | Low latency |

---

## Option 1: AWS EC2 Free Tier — Mumbai (RECOMMENDED)

**Why:** 12 months completely free. t2.micro in ap-south-1 (Mumbai).
Same region as Supabase → sub-5ms DB latency. No cold starts.

**Cost:** $0 for 12 months (750 hours/month of t2.micro = runs 24/7 free)

### Step-by-Step

#### 1. Create AWS Account
- Go to https://aws.amazon.com/free/
- Sign up (needs credit card for verification, but won't be charged)
- Select **ap-south-1 (Mumbai)** region in the console

#### 2. Launch EC2 Instance
```
AMI:           Ubuntu 24.04 LTS (free tier eligible)
Instance type: t2.micro (1 vCPU, 1 GB RAM)
Storage:       20 GB gp3 (free tier includes 30 GB)
Security group: Allow inbound on ports 22 (SSH), 80 (HTTP), 443 (HTTPS)
Key pair:      Create and download .pem file
```

#### 3. SSH Into Instance
```bash
chmod 400 gyangrit-key.pem
ssh -i gyangrit-key.pem ubuntu@<public-ip>
```

#### 4. Install Dependencies
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.11 python3.11-venv python3-pip nginx certbot python3-certbot-nginx git

# Create app directory
sudo mkdir -p /opt/gyangrit
sudo chown ubuntu:ubuntu /opt/gyangrit
```

#### 5. Clone and Setup
```bash
cd /opt/gyangrit
git clone https://github.com/<your-username>/GyanGrit.git .
cd backend

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements/prod.txt
```

#### 6. Create Environment File
```bash
cat > /opt/gyangrit/backend/.env << 'EOF'
DJANGO_SETTINGS_MODULE=gyangrit.settings.prod
SECRET_KEY=<generate-with-django-get-random-secret-key>
DATABASE_URL=postgres://postgres.rvyuccwggicloiyoixjb:<password>@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require
ALLOWED_HOSTS=<your-domain-or-ec2-ip>
CORS_ALLOWED_ORIGINS=https://gyan-grit.vercel.app
DEBUG=False

# Copy all other env vars from Render...
EMAIL_HOST_USER=veerababusaviti2103@gmail.com
EMAIL_HOST_PASSWORD=<gmail-app-password>
CLOUDFLARE_R2_ACCOUNT_ID=<your-id>
CLOUDFLARE_R2_ACCESS_KEY_ID=<your-key>
CLOUDFLARE_R2_SECRET_ACCESS_KEY=<your-secret>
CLOUDFLARE_R2_BUCKET_NAME=gyangrit-media
CLOUDFLARE_R2_PUBLIC_URL=<your-url>
ABLY_API_KEY=<your-key>
FAST2SMS_API_KEY=<your-key>
GEMINI_API_KEY=<your-key>
LIVEKIT_URL=<your-url>
LIVEKIT_API_KEY=<your-key>
LIVEKIT_API_SECRET=<your-secret>
SENTRY_DSN=<your-dsn>
UPSTASH_REDIS_KV_URL=<your-url>
EOF
```

#### 7. Run Migrations + Collect Static
```bash
source venv/bin/activate
python manage.py migrate --no-input
python manage.py collectstatic --no-input
```

#### 8. Create Systemd Service
```bash
sudo cat > /etc/systemd/system/gyangrit.service << 'EOF'
[Unit]
Description=GyanGrit Django Backend
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/opt/gyangrit/backend
Environment=DJANGO_SETTINGS_MODULE=gyangrit.settings.prod
EnvironmentFile=/opt/gyangrit/backend/.env
ExecStart=/opt/gyangrit/backend/venv/bin/gunicorn \
    gyangrit.wsgi:application \
    -c gunicorn.conf.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable gyangrit
sudo systemctl start gyangrit
```

#### 9. Configure Nginx (Reverse Proxy + SSL)
```bash
sudo cat > /etc/nginx/sites-available/gyangrit << 'EOF'
server {
    listen 80;
    server_name <your-domain-or-ip>;

    location /static/ {
        alias /opt/gyangrit/backend/staticfiles/;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/gyangrit /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 10. Add SSL (if you have a domain)
```bash
sudo certbot --nginx -d <your-domain>
```

#### 11. Update Vercel Frontend
Set `VITE_API_URL=https://<your-domain>/api/v1` in Vercel dashboard.

#### 12. Auto-Deploy with GitHub Actions (Optional)
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy Backend
on:
  push:
    branches: [main]
    paths: ['backend/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to EC2
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_KEY }}
          script: |
            cd /opt/gyangrit
            git pull origin main
            cd backend
            source venv/bin/activate
            pip install -r requirements/prod.txt
            python manage.py migrate --no-input
            python manage.py collectstatic --no-input
            sudo systemctl restart gyangrit
```

---

## Option 2: Oracle Cloud — Hyderabad (Always Free, Best VPS)

**Why:** Truly always-free ARM VM (4 OCPU, 24 GB RAM!) in Hyderabad.
Way more powerful than any other free tier. ~30ms to Mumbai Supabase.

**Cost:** $0 forever (Always Free tier, not time-limited)

**Catch:** Availability of Always Free ARM instances fluctuates — you may
need to try multiple times to provision one. Use the "retry script" trick
(Google "oracle cloud always free arm instance retry").

**Specs:** Up to 4 ARM OCPU, 24 GB RAM, 200 GB block storage

Setup is similar to AWS EC2 above — SSH in, install Python, clone repo,
set up systemd + nginx. The only difference is the OS (Oracle Linux or
Ubuntu) and the cloud console UI.

1. Sign up at https://www.oracle.com/cloud/free/
2. Select Hyderabad (ap-hyderabad-1) as home region
3. Create an Always Free ARM instance (Ampere A1)
4. Follow steps 3-12 from the AWS guide above

---

## Option 3: GCP Cloud Run — Mumbai

**Why:** $300 free credit for 90 days. Serverless (auto-scales to zero
when idle, scales up when traffic comes). Mumbai region available.

**Cost:** $0 for 90 days (credit-based), then ~$5-10/month for low traffic

Uses Docker, so you need the Dockerfile from `backend/Dockerfile`.

```bash
# Install gcloud CLI, authenticate
gcloud auth login
gcloud config set project <your-project-id>
gcloud config set run/region asia-south1  # Mumbai

# Build and push Docker image
cd backend
gcloud builds submit --tag gcr.io/<project-id>/gyangrit

# Deploy
gcloud run deploy gyangrit \
  --image gcr.io/<project-id>/gyangrit \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars "DJANGO_SETTINGS_MODULE=gyangrit.settings.prod" \
  --set-env-vars "SECRET_KEY=<your-key>" \
  --set-env-vars "DATABASE_URL=<your-url>" \
  --set-env-vars "ALLOWED_HOSTS=<service-url>" \
  --set-env-vars "CORS_ALLOWED_ORIGINS=https://gyan-grit.vercel.app" \
  --port 8000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1  # prevents cold starts (costs more but stays warm)
```

---

## Keeping Render Warm (If Staying on Render)

If you stay on Render for now, prevent cold starts with a cron ping:

### Upstash QStash (Free, Recommended)
1. Go to https://console.upstash.com/qstash → Schedules → Create
2. URL: `https://gyangrit.onrender.com/api/v1/health/`
3. Method: GET
4. Cron: `*/5 * * * *` (every 5 minutes)
5. QStash free tier: 500 messages/day (288 used = well within limit)

### UptimeRobot (Free, Alternative)
1. Sign up at https://uptimerobot.com
2. Add HTTP monitor: `https://gyangrit.onrender.com/api/v1/health/`
3. Interval: 5 minutes
4. Bonus: get email alerts when the backend goes down

### Cron-job.org (Free)
1. Sign up at https://cron-job.org
2. GET `https://gyangrit.onrender.com/api/v1/health/` every 5 minutes

---

## My Recommendation

**For your capstone deadline (this week):**
Stay on Render + set up QStash/UptimeRobot keep-alive (2 minutes of work).
The gthread worker switch already fixed the crash, and cold starts won't happen
with a 5-minute ping.

**After capstone:**
Migrate to AWS EC2 Mumbai (ap-south-1). 12 months free, same region as
Supabase, no cold starts, full control. DB latency drops from ~100ms to ~3ms.

**Long-term:**
Oracle Cloud Hyderabad Always Free is the best deal in cloud computing.
4 OCPU + 24 GB RAM for free, forever. But provisioning can be tricky.
