# GyanGrit — Useful Backend Commands

## SSH into Oracle Server
```bash
ssh -i ~/Downloads/ssh-key-2026-03-26.key ubuntu@161.118.168.247
```

## Database Backup
```bash
pg_dump \
  -h aws-0-ap-south-1.pooler.supabase.com \
  -U postgres.<project> \
  -d postgres \
  -Fc > gyangrit_backup_$(date +%Y%m%d).dump
```

## Manual Deploy on Oracle
```bash
cd /opt/gyangrit
git pull origin master
source backend/venv/bin/activate
pip install -r backend/requirements/prod.txt
cd backend
python manage.py migrate --no-input
python manage.py collectstatic --no-input --clear
cd /opt/gyangrit
sudo systemctl reload gyangrit
curl http://127.0.0.1:8000/api/v1/health/
```

## View Live Logs
```bash
sudo journalctl -u gyangrit -f
sudo journalctl -u gyangrit -n 100 --no-pager
sudo tail -20 /var/log/nginx/error.log
```

## Django Management Commands
```bash
python manage.py seed_punjab           # Seed districts, institutions, sections
python manage.py generate_vapid_keys   # One-time VAPID key generation
python manage.py createsuperuser
python manage.py check
python manage.py migrate --plan
python manage.py shell
```

## Generate Project Tree
```bash
tree backend frontend docs \
  -I "node_modules|__pycache__|*.pyc|staticfiles|dist|build|.git|.DS_Store" \
  > project_structure_clean.txt
```

## Pre-Push Checklist
```bash
cd backend && python manage.py check 2>&1 | tail -3
cd frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -20
```


## Co-Authors
```bash
Co-authored-by: harshitha <honey77490@gmail.com>"
```