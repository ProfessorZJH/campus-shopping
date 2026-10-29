FROM python:3.11-slim-bookworm
WORKDIR /app
COPY requirements.lock .
RUN pip install --no-cache-dir --require-hashes -r requirements.lock
COPY app ./app
RUN useradd -r -u 10001 appuser && mkdir -p /app/var && chown -R appuser /app
USER appuser
EXPOSE 8100
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8100", "--workers", "1"]
