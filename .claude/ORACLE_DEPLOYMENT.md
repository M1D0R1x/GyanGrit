# GyanGrit — Ultimate Oracle Cloud Deployment Guide (Mumbai)

This guide provides a microscopic, step-by-step walkthrough of deploying your Django backend to Oracle Cloud Infrastructure (OCI). It is specifically tailored to troubleshoot and resolve network timeouts, SSH issues, and Oracle's strict firewall rules.

## Phase 1: Fixing the "Operation Timed Out" SSH Error (Networking Setup)

Based on your logs, your SSH connection is timing out (`port 22: Operation timed out`). This happens because your Virtual Cloud Network (VCN) called `GyanGrit-VCN` is completely isolated from the internet. A public IP is not enough; the VCN needs a gateway and a route.

### Step 1.1: Create an Internet Gateway
1. In the Oracle Cloud Console, go to **Networking > Virtual cloud networks**.
2. Click on your VCN: **GyanGrit-VCN**.
3. On the left menu under Resources, click **Internet Gateways**.
4. Click the blue **Create Internet Gateway** button.
5. Name it something like `gyangrit-igw` and click **Create Internet Gateway**.

### Step 1.2: Update the Route Table (CRITICAL)
Your server doesn't know how to send traffic back to the internet.
1. Still inside your VCN page, click **Route Tables** on the left.
2. Click on **Default Route Table for GyanGrit-VCN**. (Your logs showed this had "No items to display").
3. Click **Add Route Rules**.
4. Fill in the following exactly:
   - **Target Type**: Internet Gateway
   - **Destination Type**: CIDR Block
   - **Destination CIDR Block**: `0.0.0.0/0`
   - **Target Internet Gateway**: Select the `gyangrit-igw` you just created.
5. Click **Add Route Rules**.

### Step 1.3: Update the Security List (Firewall)
You need to explicitly allow SSH (Port 22), HTTP (Port 80), and HTTPS (Port 443) traffic.
1. Go back to your VCN page and click **Security Lists** on the left.
2. Click on **Default Security List for GyanGrit-VCN**.
3. Under **Ingress Rules**, click **Add Ingress Rules**.
4. Add the following rules one by one (click "+ Additional Ingress Rule" to add multiple):
   - **Rule 1 (SSH)**: Source CIDR: `0.0.0.0/0`, IP Protocol: `TCP`, Destination Port Range: `22`
   - **Rule 2 (HTTP)**: Source CIDR: `0.0.0.0/0`, IP Protocol: `TCP`, Destination Port Range: `80`
   - **Rule 3 (HTTPS)**: Source CIDR: `0.0.0.0/0`, IP Protocol: `TCP`, Destination Port Range: `443`
5. Click **Add Ingress Rules**.

---

## Phase 2: Connecting to the Instance

Now that the network is actually routing traffic, your SSH command will work.

### Step 2.1: Key Permissions
Mac requires SSH keys to be strictly private.
Open your macOS Terminal and run:
```bash
cd ~/Downloads
chmod 400 ssh-key-2026-03-26.key
```

### Step 2.2: The SSH Command
Your username is strictly `ubuntu` (not root, not opc). Your IP is `161.118.168.247`.
```bash
ssh -i ssh-key-2026-03-26.key ubuntu@161.118.168.247
```
When it asks `Are you sure you want to continue connecting (yes/no)?`, type exactly `yes` and press Enter.

*(If it still says "Operation timed out", double check that Step 1.2 Route Rules were saved successfully).*

---

## Phase 3: System Prep & Cloning (Inside Oracle VM)

You are now in the `ubuntu@gyangrit:~$` terminal.

### Step 3.1: Install Dependencies
```bash
# Update Ubuntu package lists
sudo apt update && sudo apt upgrade -y

# Install Python (Ubuntu 24.04 uses Python 3.12 by default), Nginx, Certbot, and Git
sudo apt install -y python3 python3-venv python3-pip nginx certbot python3-certbot-nginx git

# Create the folder where GyanGrit will live
sudo mkdir -p /opt/gyangrit

# Give the 'ubuntu' user full ownership of this folder
sudo chown ubuntu:ubuntu /opt/gyangrit
```

### Step 3.2: Clone Repository using GitHub PAT
To bypass password prompts, we will use your Personal Access Token.

```bash
cd /opt/gyangrit

# Clone using your PAT
git clone https://<YOUR_GITHUB_USER>:<YOUR_GITHUB_PAT>@github.com/M1D0R1x/GyanGrit.git .
```

### Step 3.3: Python Virtual Environment
```bash
cd /opt/gyangrit/backend

# Create virtual environment isolated from the system Python
python3 -m venv venv

# Activate it (You must do this every time you run pip or manage.py)
source venv/bin/activate

# Install Django and dependencies
pip install -r requirements/prod.txt
```

---

## Phase 4: Environment Variables & Database

### Step 4.1: The .env File
Oracle knows nothing about your Render variables. You must paste them manually.
```bash
nano /opt/gyangrit/backend/.env
```

Paste EXACTLY the following format (fill in your actual values):
```env
DJANGO_SETTINGS_MODULE=gyangrit.settings.prod
SECRET_KEY=put_a_long_random_string_here_no_quotes
DATABASE_URL=postgres://... (Your Supabase URL)

# CRITICAL: Include the Oracle IP and your domain
ALLOWED_HOSTS=161.118.168.247,api.gyangrit.site
CORS_ALLOWED_ORIGINS=https://gyangrit.site,https://www.gyangrit.site

# Email
EMAIL_HOST=smtp.zoho.in
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=noreply@gyangrit.site
EMAIL_HOST_PASSWORD=your_zoho_app_password
DEFAULT_FROM_EMAIL=GyanGrit <noreply@gyangrit.site>

# Add all other variables (LiveKit, Gemini, R2, Sentry) below...
```
Press `CTRL+X`, then type `Y`, then hit `ENTER` to save and exit.

### Step 4.2: Django Setup Run
Ensure `venv` is active, then run:
```bash
python manage.py migrate --no-input
python manage.py collectstatic --no-input
```

---

## Phase 5: Gunicorn (The App Server)

We need Gunicorn to run your Django app 24/7 in the background via `systemd`.

### Step 5.1: Create the Service
```bash
sudo nano /etc/systemd/system/gyangrit.service
```

Paste exactly this:
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
Save and exit (`CTRL+X`, `Y`, `ENTER`).

### Step 5.2: Start the Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable gyangrit
sudo systemctl start gyangrit

# Verify it is running (Look for "Active: active (running)")
sudo systemctl status gyangrit
```
*(Press `q` to exit the status screen).*

---

## Phase 6: Nginx & Oracle Internal Firewall

### Step 6.1: Nginx Configuration
Nginx takes internet traffic (Port 80) and sends it to Gunicorn (Port 8000).

```bash
sudo nano /etc/nginx/sites-available/gyangrit
```

Paste this:
```nginx
server {
    listen 80;
    server_name 161.118.168.247 api.gyangrit.site;

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
Save and exit.

Enable it:
```bash
sudo rm /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/gyangrit /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6.2: The Oracle iptables Trap (CRITICAL)
**Even though you opened ports in the Oracle Cloud Console (Phase 1), Ubuntu on Oracle ships with a hardened internal firewall that blocks Nginx.** 

Oracle inserts a strict wildcard `REJECT` rule at line 5. You MUST insert your rules **above** it (by pushing them into line 5):

```bash
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

**TEST:** At this extremely satisfying moment, open your browser on your Mac and go to: `http://161.118.168.247/api/v1/health/`. You should see `{ "status": "ok" }`.

---

## Phase 7: Free SSL (HTTPS)

You cannot use APIs securely over raw HTTP. You must encrypt it.

1. Go to your Domain Registrar or Vercel DNS settings.
2. Add an **A Record**.
   - **Name**: `api`
   - **Value**: `161.118.168.247`
3. Wait 10 minutes for DNS to propagate.
4. On your Oracle server, run Certbot to automatically fetch a free Let's Encrypt certificate:

```bash
sudo certbot --nginx -d api.gyangrit.site
```
Certbot will auto-renew forever. You now have a production-grade backend!

---

## Phase 8: Finalizing the Frontend

1. Go to your Vercel Dashboard for GyanGrit.
2. Go to **Settings > Environment Variables**.
3. Edit `VITE_API_URL` and change it from your Render URL to:
   `https://api.gyangrit.site/api/v1`
4. Deploy the Vercel project again.

Your latency will drop to nothing, cold starts are gone.

---

## Phase 9: How to Redeploy Backend Code (Future Updates)

Whenever you make changes to your Django backend on your laptop and run `git push origin master`, your Oracle server needs to pull those changes down. 

Instead of doing the whole setup again, just open your Mac terminal and run these 6 quick commands:

```bash
# 1. SSH into your Oracle server
ssh -i ~/Downloads/ssh-key-2026-03-26.key ubuntu@161.118.168.247

# 2. Navigate to your app folder and pull the latest code
cd /opt/gyangrit
git pull origin master

# 3. Activate your Python environment
source backend/venv/bin/activate

# 4. (Optional) Run pip install if you added any new packages
pip install -r backend/requirements/prod.txt

# 5. Apply any new database changes
python backend/manage.py migrate

# 6. Restart the invisible background service so it loads the new code
sudo systemctl restart gyangrit
```
That's it! Your backend is instantly updated.

---

## Phase 10: Automatic Deployment via GitHub Actions (Optional)

If you never want to SSH into the server manually again, you can set up a CI/CD pipeline so GitHub does it for you automatically every time you `git push`.

### 1. Add GitHub Secrets
Go to your **GitHub Repository > Settings > Secrets and variables > Actions**.
Click **New repository secret** and add these three secrets exactly:
- `ORACLE_HOST`: `161.118.168.247`
- `ORACLE_USERNAME`: `ubuntu`
- `ORACLE_KEY`: The entire raw contents of your strictly private `ssh-key-2026-03-26.key` file (including the `-----BEGIN...` and `END-----` lines).

### 2. Create the Workflow File
In your codebase on your laptop, create a new file exactly at: `.github/workflows/deploy.yml`

Paste this code into it:

```yaml
name: Deploy Backend to Oracle

on:
  push:
    branches:
      - master
    paths:
      - 'backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.ORACLE_HOST }}
          username: ${{ secrets.ORACLE_USERNAME }}
          key: ${{ secrets.ORACLE_KEY }}
          script: |
            cd /opt/gyangrit
            git pull origin master
            source backend/venv/bin/activate
            pip install -r backend/requirements/prod.txt
            python backend/manage.py migrate
            sudo systemctl restart gyangrit
```

Now, every time you commit and push changes that specifically touch the `backend/` folder, GitHub will invisibly SSH into your server and run all 6 of those commands for you in about 5 seconds!

---

## Phase 11: How to View Live Server Logs

While Render provided a nice web console for your `print()` statements and errors, on a native Linux server, everything is automatically captured by `journalctl`. 

If you ever need to debug the backend directly or see live traffic coming in (in addition to your Sentry dashboard), SSH into your Oracle server and run these commands:

### 1. Watch Live Django Logs (Like the Render Console)
To see a live, infinitely scrolling feed of every request, error, and `print()` statement from your Django app in real-time:
```bash
sudo journalctl -u gyangrit -f
```
*(Press `CTRL+C` to exit the live stream).*

### 2. Read the Last 100 Lines
If the app crashed earlier and you just want to read what happened without streaming the live output:
```bash
sudo journalctl -u gyangrit -n 100 --no-pager
```

### 3. Check Nginx Routing Errors
If the server is throwing a `502 Bad Gateway` and the traffic isn't even reaching Django, check the Nginx error log:
```bash
sudo tail -f /var/log/nginx/error.log
```
