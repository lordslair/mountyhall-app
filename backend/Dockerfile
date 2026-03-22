FROM python:3.14-slim

WORKDIR /app

# Set Python environment variables for logging
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app

# Copy requirements first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make init scripts executable (before switching to appuser)
RUN chmod +x init_db.sh init_database.py 2>/dev/null || true

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/auth/health')"

# Run with gunicorn in production, flask run in development
CMD if [ "$FLASK_ENV" = "production" ]; then \
      gunicorn --bind 0.0.0.0:5000 --workers 2 --timeout 120 wsgi:app; \
    else \
      python app.py; \
    fi
