#!/bin/sh

# Start FastAPI backend on port 8000 (internal only)
python3 -m uvicorn api.server:app --host 127.0.0.1 --port 8000 &

# Start Next.js server on port 3000 (exposed)
npx next start -p 3000
