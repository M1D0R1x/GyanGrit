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
# No code changes needed in Django — gevent monkey-patches stdlib at startup.

import os

# ── Worker class ───────────────────────────────────────────────────────────
worker_class       = "gevent"
workers            = 1          # 1 worker is correct for 512MB — gevent handles concurrency
worker_connections = 100        # max simultaneous connections per worker

# ── Timeouts ──────────────────────────────────────────────────────────────
timeout            = 60         # 60s — long enough for slow Supabase queries
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
