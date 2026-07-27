#!/bin/sh
ollama serve &
sleep 3
ollama pull mxbai-embed-large
exec uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}
