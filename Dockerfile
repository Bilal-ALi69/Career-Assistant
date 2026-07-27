FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl zstd && \
    rm -rf /var/lib/apt/lists/* && \
    curl -fsSL https://ollama.com/install.sh | sh

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
RUN chmod +x start.sh

EXPOSE 8000

CMD ["./start.sh"]
