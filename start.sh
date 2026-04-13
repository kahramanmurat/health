#!/bin/sh

# Start FastAPI backend on port 3001 (internal only)
python3 -m uvicorn api.server:app --host 127.0.0.1 --port 3001 &

# Start Next.js server on port 8000 (App Runner exposed port)
npx next start -p 8000
