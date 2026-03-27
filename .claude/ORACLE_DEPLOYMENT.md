# GyanGrit — Oracle Cloud Deployment Guide (Mumbai)

This guide takes you from a brand-new Oracle Cloud instance in Mumbai to a fully running, production-ready Django backend, using your specific SSH keys.

## Assumptions
- You have provisioned an **Ubuntu** instance (either AMD Micro or ARM Ampere A1) in the **India West (Mumbai)** region.
- You allowed HTTP (80) and HTTPS (443) traffic in your Oracle Virtual Cloud Network (VCN) Default Security List.
- You have your private SSH key: `ssh-key-2026-03-26.key`

---

## Step 1: Connect to your Server

First, restrict the permissions on your private key so SSH allows you to use it, then connect to the public IP address of your Oracle VM.

Open your terminal on your Mac and run:
```bash
# 1. Navigate to where your key is saved (assuming Downloads)
cd ~/Downloads

# 2. Lock down the key permissions (required by SSH)
chmod 400 ssh-key-2026-03-26.key

# 3. Connect to the server (Replace <YOUR_ORACLE_PUBLIC_IP> with the actual IP)
# Note: Oracle Ubuntu instances use the username 'ubuntu'
ssh -i ssh-key-2026-03-26.key ubuntu@<YOUR_ORACLE_PUBLIC_IP>
```

---

## Step 2: Install System Dependencies

Once you are logged into the Oracle server, update the system and install Python, Nginx, and Git.

```bash
# 1. Update package lists
sudo apt update && sudo apt upgrade -y

# 2. Install Python 3.11, Nginx, Certbot, and venv
sudo apt install -y python3.11 python3.11-venv python3-pip nginx certbot python3-certbot-nginx git

# 3. Create a directory for GyanGrit and take ownership
sudo mkdir -p /opt/gyangrit
sudo chown ubuntu:ubuntu /opt/gyangrit
```

---

## Step 3: Clone the Repository & Setup Python

```bash
# 1. Go to the app directory
cd /opt/gyangrit

# 2. Clone your repository (You may need to generate a GitHub Personal Access Token or use HTTPS)
git clone https://github.com/M1D0R1x/GyanGrit.git .
# Note: If git clone prompts for a password, use a GitHub Personal Access Token.

# 3. Go into the backend folder
cd backend

# 4. Create the virtual environment
python3.11 -m venv venv

# 5. Activate it
source venv/bin/activate

# 6. Install all production dependencies
pip install -r requirements/prod.txt
```

---

## Step 4: Create the `.env` File

You need to recreate your environment variables on the server. We will use the `nano` text editor.

```bash
nano /opt/gyangrit/backend/.env
```

Paste your production `.env` variables into the editor. It must include everything from your Render setup, plus the new Twilio variables:

```env
DJANGO_SETTINGS_MODULE=gyangrit.settings.prod
SECRET_KEY=your_long_secret_key_here
DATABASE_URL=postgres://... (Your Supabase URL)
ALLOWED_HOSTS=<YOUR_ORACLE_PUBLIC_IP>,api.gyangrit.site
CORS_ALLOWED_ORIGINS=https://gyangrit.site,https://www.gyangrit.site

# Email (Zoho)
EMAIL_HOST=smtp.zoho.in
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=noreply@gyangrit.site
EMAIL_HOST_PASSWORD=your_zoho_app_password
DEFAULT_FROM_EMAIL=GyanGrit <noreply@gyangrit.site>

# Twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# Cloudflare R2
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET_NAME=gyangrit-media
CLOUDFLARE_R2_PUBLIC_URL=...

# Other APIs
ABLY_API_KEY=...
GEMINI_API_KEY=...
LIVEKIT_URL=...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
SENTRY_DSN=...
UPSTASH_REDIS_KV_URL=...
```
*(Save and exit `nano` by pressing `CTRL+X`, then `Y`, then `ENTER`)*

---

## Step 5: Database Migrations & Static Files

With the environment ready and virtual environment active, run the Django setup commands:

```bash
python manage.py migrate --no-input
python manage.py collectstatic --no-input
```

---

## Step 6: Create the Gunicorn System Service

We need GyanGrit to run automatically in the background, even if the server restarts. We do this by creating a `systemd` service.

```bash
# Open a new service file
sudo nano /etc/systemd/system/gyangrit.service
```

Paste the following configuration:

```ini
[Unit]
Description=GyanGrit Django Backend
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/opt/gyangrit/backend
Environment=DJANGO_SETTINGS_MODULE=gyangrit.settings.prod
EnvironmentFile=/opt/gyangrit/backend/.env
ExecStart=/opt/gyangrit/backend/venv/bin/gunicorn gyangrit.wsgi:application -c gunicorn.conf.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```
*(Save and exit: `CTRL+X`, `Y`, `ENTER`)*

Now start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable gyangrit
sudo systemctl start gyangrit

# Check if it's running successfully without errors:
sudo systemctl status gyangrit
```

---

## Step 7: Configure Nginx as a Reverse Proxy

Nginx will face the internet on port 80/443 and forward requests to Gunicorn running on port 8000.

```bash
# Create the Nginx config file
sudo nano /etc/nginx/sites-available/gyangrit
```

Paste this configuration (replace `<YOUR_ORACLE_PUBLIC_IP>`):
```nginx
server {
    listen 80;
    server_name <YOUR_ORACLE_PUBLIC_IP> api.gyangrit.site;

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
```
*(Save and exit: `CTRL+X`, `Y`, `ENTER`)*

Enable the site and restart Nginx:
```bash
# Remove default nginx holding page
sudo rm /etc/nginx/sites-enabled/default

# Enable our config
sudo ln -s /etc/nginx/sites-available/gyangrit /etc/nginx/sites-enabled/

# Test the config to make sure there are no syntax errors
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## Step 8: Oracle Firewall (iptables)

Oracle Ubuntu images have a strict internal firewall (`iptables`) by default, even if you opened the ports in the Oracle Cloud Console. You must open port 80 and 443 internally:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

At this point, you should be able to visit `http://<YOUR_ORACLE_PUBLIC_IP>/api/v1/health/` in your browser and see the backend is alive!

---

## Step 9: Add a Custom Domain and Free SSL (HTTPS)

Once you point your domain (e.g. `api.gyangrit.site`) to the Oracle IP address via an A-Record in your Vercel DNS settings, you can secure it with a free SSL certificate:

```bash
sudo certbot --nginx -d api.gyangrit.site
```
Certbot will auto-configure HTTPS and set up a cron job to renew the certificate every 90 days automatically.

---

## Step 10: Update Vercel Frontend
Back in Vercel (where your frontend is hosted), go to the GyanGrit project settings -> Environment Variables.
Update `VITE_API_URL` to `https://api.gyangrit.site/api/v1`.
Redeploy the Vercel frontend.

**You are done! Fully hosted in Mumbai.**
