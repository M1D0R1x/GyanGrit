# GyanGrit — Oracle Cloud Setup Commands (2026-04-04)
# Run these in order in your SSH session.
# ubuntu@gyangrit:~$

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: Generate the values you need before editing .env
# ─────────────────────────────────────────────────────────────────────────────

# 1a. New SECRET_KEY (copy the output)
python3 -c "import secrets; print(secrets.token_urlsafe(50))"

# 1b. LiveKit webhook secret (copy the output)
openssl rand -hex 32

# 1c. VAPID keys for push notifications
source /opt/gyangrit/backend/venv/bin/activate
python3 -c "
from py_vapid import Vapid
v = Vapid()
v.generate_keys()
priv = v.private_pem().decode().strip()
print('VAPID_PRIVATE_KEY=' + priv)
print('VAPID_PUBLIC_KEY=' + v.public_key)
"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: Edit .env — add/update all missing variables
# ─────────────────────────────────────────────────────────────────────────────
# nano /opt/gyangrit/backend/.env
#
# CHANGE this line (replace the insecure placeholder):
#   SECRET_KEY=django-insecure-change-this-to-a-long-random-string
# → SECRET_KEY=<output from step 1a>
#
# ADD these lines at the bottom:
#   LIVEKIT_RECORDING_WEBHOOK_SECRET=<output from step 1b>
#   CLOUDFLARE_R2_RECORDINGS_PREFIX=recordings/
#   BACKEND_BASE_URL=https://api.gyangrit.site
#   VAPID_PRIVATE_KEY=<output from step 1c — the long -----BEGIN... block>
#   VAPID_PUBLIC_KEY=<output from step 1c — the short base64 string>
#   VAPID_CLAIMS_EMAIL=mailto:noreply@gyangrit.site
#   GROQ_API_KEY=gsk_<get from https://console.groq.com → API Keys>
#   TOGETHER_API_KEY=<get from https://api.together.xyz → Settings → API Keys>
#   UPSTASH_REDIS_KV_URL=rediss://default:<pass>@<host>.upstash.io:6379
#   QSTASH_TOKEN=<get from https://console.upstash.com → QStash>

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: Install Together AI SDK (already in prod.txt, may not be installed)
# ─────────────────────────────────────────────────────────────────────────────
source /opt/gyangrit/backend/venv/bin/activate
pip install together>=1.3
pip show together | grep Version

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: Update Nginx config
# ─────────────────────────────────────────────────────────────────────────────
sudo nano /etc/nginx/sites-available/gyangrit
# Paste the contents from docs/NGINX_ORACLE_CONFIG.md
# IMPORTANT: Keep the ssl_certificate / ssl_certificate_key lines exactly as
# Certbot wrote them — just replace everything else.

# Test Nginx config before applying
sudo nginx -t

# Apply
sudo systemctl reload nginx

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: Reload gunicorn to pick up new .env vars
# ─────────────────────────────────────────────────────────────────────────────
sudo systemctl reload gyangrit

# Wait 3 seconds then verify it started clean
sleep 3
sudo journalctl -u gyangrit -n 30 --no-pager

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6: Verify everything is working
# ─────────────────────────────────────────────────────────────────────────────

# Health check
curl -s https://api.gyangrit.site/api/v1/health/ | python3 -m json.tool

# Check CSRF endpoint (should return 200 + set cookie)
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://api.gyangrit.site/api/v1/auth/csrf/

# Verify gzip is working (should show "Content-Encoding: gzip")
curl -s -I -H "Accept-Encoding: gzip" https://api.gyangrit.site/api/v1/health/ | grep -i encoding

# Check Nginx error log for any issues
sudo tail -20 /var/log/nginx/gyangrit_error.log

# ─────────────────────────────────────────────────────────────────────────────
# STEP 7: Apply pending system updates (safe to do now)
# ─────────────────────────────────────────────────────────────────────────────
sudo apt update
sudo apt upgrade -y
# If kernel updated, schedule a reboot for off-hours:
# sudo reboot
