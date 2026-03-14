#!/bin/bash
# AppyStack Template
cd "$(dirname "$0")/.."

echo "================================================"
echo "AppyStack Template - Development Server"
echo "================================================"
echo ""

# Check if already running
if lsof -i :5501 | grep -q LISTEN; then
  echo "Server is already running on ports 5500/5501"
  echo "Opening browser..."
  open http://localhost:5500
  exit 0
fi

echo "Building shared types..."
npm run build -w shared

echo ""
echo "Starting dev server (client: 5500, server: 5501) via Overmind..."
echo "  overmind connect client  — attach to client logs"
echo "  overmind connect server  — attach to server logs"
echo "  overmind stop            — stop all processes"
echo ""

# Open browser after delay (background — gives server time to start)
(sleep 4 && open http://localhost:5500) &

overmind start
