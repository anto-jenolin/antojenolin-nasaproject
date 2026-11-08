#!/bin/bash
echo "=========================================="
echo "  TerraPulse AI - Starting Server"
echo "=========================================="
echo ""
echo "Open browser at: http://localhost:8000"
echo "Admin login: admin@terrapulse.local"
echo "Admin password: TerraPulse@Admin2024"
echo ""
echo "Press Ctrl+C to stop the server."
echo ""
cd "$(dirname "$0")/backend" || exit 1
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
