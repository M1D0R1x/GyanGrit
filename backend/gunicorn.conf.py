# gunicorn.conf.py
# Gunicorn configuration for GyanGrit production (Oracle Cloud Mumbai).
#
# WORKER CLASS: gthread (threaded sync workers)
# ─────────────────────────────────────────────────────────────────
# gthread is simpler, stable across all Python versions, and sufficient
# for GyanGrit's scale.
#
# Oracle Cloud VM.Standard.A1.Flex — 2 OCPU, 12 GB RAM, ARM64
# Worker formula: 2 × OCPU + 1 = 5 workers
#   - 5 workers × 4 threads = 20 concurrent requests
#   - Memory: ~200 MB per worker × 5 = ~1 GB (leaves 11 GB free)
#   - No monkey-patching required
#   - psycopg, redis, and boto3 all work without gevent-specific hacks
#
# If you need more concurrency later (1000+ users), consider gevent
# on Python 3.11/3.12 where it's stable, or add a second OCPU.

import os

# ── Worker class ───────────────────────────────────────────────────────────
worker_class       = "gthread"
workers            = 3          # 3 workers × 6 threads = 18 concurrent requests
                                # Reduced from 5 to cut peak RSS (was hitting OOM on heavy requests)
threads            = 6          # More threads per worker — I/O-bound views benefit

# ── Preload ────────────────────────────────────────────────────────────────
# Load Django BEFORE forking workers:
#   1. Import errors show up in boot log (not silently swallowed)
#   2. Shared memory between workers (saves ~50MB)
#   3. If Django can't start, gunicorn exits immediately with a clear error
preload_app = True

# ── Timeouts ──────────────────────────────────────────────────────────────
timeout            = 60         # 60s — allows for slow R2/LiveKit API calls and complex queries
graceful_timeout   = 30         # 30s to finish in-flight requests on restart
keepalive          = 75         # keep-alive for Nginx → Gunicorn upstream reuse

# ── Binding ───────────────────────────────────────────────────────────────
# Oracle Cloud: Nginx proxies to Gunicorn on port 8000
bind               = f"0.0.0.0:{os.environ.get('PORT', '8000')}"

# ── Logging ───────────────────────────────────────────────────────────────
accesslog          = "-"        # stdout
errorlog           = "-"        # stdout
loglevel           = "info"

# ── Memory management ─────────────────────────────────────────────────────
max_requests       = 300        # recycle worker after 300 requests (prevents memory growth)
max_requests_jitter = 50        # randomise so all workers don't restart simultaneously

# ── Django DB connection cleanup ──────────────────────────────────────────
# Close DB connections after forking so each worker gets its own connection.
# With gthread + conn_max_age=60 (set in prod.py), connections are persistent
# within a worker but reset cleanly at fork time.
def post_fork(server, worker):
    from django.db import connections
    for conn in connections.all():
        conn.close()
