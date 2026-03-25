# gunicorn.conf.py
# Gunicorn configuration for GyanGrit production (Render free tier).
#
# WORKER CLASS: gthread (threaded sync workers)
# ─────────────────────────────────────────────────────────────────
# Previously used gevent, but gevent's monkey-patching of ssl causes
# crashes and warnings on Python 3.13+ / 3.14. The ssl MonkeyPatchWarning
# ("Monkey-patching ssl after ssl has already been imported") is triggered
# by redis, boto3, urllib3, and anyio all importing ssl before gevent
# can patch it (because preload_app=True loads Django first).
#
# gthread is simpler, stable across all Python versions, and sufficient
# for GyanGrit's scale (~50 concurrent users on free tier):
#   - 2 workers × 4 threads = 8 concurrent requests
#   - No monkey-patching required
#   - psycopg, redis, and boto3 all work without gevent-specific hacks
#
# If you need more concurrency later (500+ users), switch back to gevent
# on Python 3.11/3.12 where it's stable.

import os

# ── Worker class ───────────────────────────────────────────────────────────
worker_class       = "gthread"
workers            = 2          # 2 workers for 512MB RAM (each ~80-120MB)
threads            = 4          # 4 threads per worker = 8 concurrent requests

# ── Preload ────────────────────────────────────────────────────────────────
# Load Django BEFORE forking workers:
#   1. Import errors show up in boot log (not silently swallowed)
#   2. Shared memory between workers (saves ~50MB)
#   3. If Django can't start, gunicorn exits immediately with a clear error
preload_app = True

# ── Timeouts ──────────────────────────────────────────────────────────────
timeout            = 120        # 120s — generous for slow Supabase connections from Singapore
graceful_timeout   = 30         # 30s to finish in-flight requests on restart
keepalive          = 5

# ── Binding ───────────────────────────────────────────────────────────────
# Render injects $PORT — fallback to 8000 for local dev
bind               = f"0.0.0.0:{os.environ.get('PORT', '8000')}"

# ── Logging ───────────────────────────────────────────────────────────────
accesslog          = "-"        # stdout
errorlog           = "-"        # stdout
loglevel           = "info"

# ── Memory management ─────────────────────────────────────────────────────
max_requests       = 500        # recycle worker after 500 requests (prevents memory leaks)
max_requests_jitter = 50        # randomise so all workers don't restart simultaneously

# ── Django DB connection cleanup ──────────────────────────────────────────
# Close DB connections after forking so each worker gets its own connection.
# With gthread, Django's CONN_MAX_AGE=0 (set in prod.py) already ensures
# connections are closed after each request. This is a safety net.
def post_fork(server, worker):
    from django.db import connections
    for conn in connections.all():
        conn.close()
