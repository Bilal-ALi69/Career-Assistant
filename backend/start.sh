#!/bin/sh
ollama serve &
sleep 2
exec uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}
