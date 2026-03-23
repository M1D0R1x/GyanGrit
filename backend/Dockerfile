FROM python:3.12-slim

WORKDIR /app

# System dependencies for psycopg and openpyxl
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements/base.txt requirements/base.txt
COPY requirements/prod.txt requirements/prod.txt
RUN pip install --no-cache-dir -r requirements/prod.txt

# Copy application source
COPY . .

# Collect static files (WhiteNoise serves them at runtime)
RUN python manage.py collectstatic --no-input

EXPOSE 8000

# Run migrations then start Gunicorn
CMD ["sh", "-c", "python manage.py migrate --no-input && gunicorn gyangrit.wsgi:application --bind 0.0.0.0:8000 --workers 2 --threads 2 --timeout 120"]
