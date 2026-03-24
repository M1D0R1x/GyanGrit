# gunicorn.conf.py
# Gunicorn configuration for GyanGrit production (Render free tier).
#
# Why gevent workers:
#   Render free tier = 512MB RAM, 0.1 vCPU, 1 sync worker by default.
#   1 sync worker = 1 request at a time → queue builds up with 50 users.
#   1 gevent worker = 100 async connections → handles 50+ users on same hardware.
#   Gevent works by yielding on I/O (DB queries, Ably HTTP calls, R2 requests)
#   so the worker handles other requests while waiting for the DB to respond.
#
# IMPORTANT: Python version must be 3.11 or 3.12. Python 3.14 causes gevent
# worker crashes. Pin via runtime.txt (python-3.11.12) in the repo root.

import os

# ── Worker class ───────────────────────────────────────────────────────────
worker_class       = "gevent"
workers            = 1          # 1 worker is correct for 512MB — gevent handles concurrency
worker_connections = 100        # max simultaneous connections per worker

# ── Preload ────────────────────────────────────────────────────────────────
# Load the Django app BEFORE forking workers. This means:
#   1. Import errors show up in the boot log (not silently swallowed)
#   2. Shared memory between master and workers (saves ~50MB on free tier)
#   3. If Django can't start, gunicorn exits immediately with a clear error
preload_app = True

# ── Timeouts ──────────────────────────────────────────────────────────────
timeout            = 120        # 120s — generous for cold Supabase connections from Singapore
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

# ── Django DB connection fix for gevent ───────────────────────────────────────
# CRITICAL: gevent green threads share OS threads. Django's CONN_MAX_AGE
# creates persistent DB connections bound to the thread they were created in.
# With gevent, a connection opened in green thread A cannot be used by green
# thread B — even if both run on the same OS thread — causing:
#   DatabaseWrapper objects created in a thread can only be used in that same thread
#
# Fix: close all connections after each worker forks so each green thread
# creates its own fresh connection on first use.
def post_fork(server, worker):
    from django.db import connections
    for conn in connections.all():
        conn.close()
