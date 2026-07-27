FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://ollama.com/install.sh | sh

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN ollama serve & sleep 3 && ollama pull mxbai-embed-large && pkill ollama

COPY . .
RUN chmod +x start.sh

EXPOSE 8000

CMD ["./start.sh"]
