FROM python:3.11-slim

WORKDIR /app

# System deps for psycopg (PostgreSQL driver)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

# Install Python deps first (layer caching)
COPY requirements/base.txt requirements/base.txt
COPY requirements/prod.txt requirements/prod.txt
RUN pip install --no-cache-dir -r requirements/prod.txt

# Copy app code
COPY . .

# Collect static files at build time
RUN DJANGO_SETTINGS_MODULE=gyangrit.settings.prod \
    SECRET_KEY=build-placeholder \
    DATABASE_URL=sqlite:///tmp/build.db \
    python manage.py collectstatic --no-input

# Non-root user for security
RUN useradd -m gyangrit && chown -R gyangrit:gyangrit /app
USER gyangrit

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD curl -f http://localhost:8000/api/v1/health/ || exit 1

CMD ["gunicorn", "gyangrit.wsgi:application", "-c", "gunicorn.conf.py"]
