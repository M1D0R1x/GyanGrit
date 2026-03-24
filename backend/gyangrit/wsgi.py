"""
WSGI config for gyangrit project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

# Default to prod in production — Render sets DJANGO_SETTINGS_MODULE=gyangrit.settings.prod
# in env vars, but if it's missing (e.g. during gunicorn startup), fall back to prod
# rather than the non-existent 'gyangrit.settings' which would crash.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "gyangrit.settings.prod")

application = get_wsgi_application()
