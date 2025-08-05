#!/bin/bash

echo "🔧 Fixing Complete Yellow Panther System..."

cd /opt/yellow-panther-ai

# Kill any existing processes
echo "1. Stopping existing services..."
pkill -f 'next-server'
pkill -f 'openwebui-rag-proxy-dynamic'
sleep 3

# Update environment variables
echo "2. Updating environment configuration..."
echo "RAG_BACKEND_URL=http://localhost:3000" >> .env.local
export RAG_BACKEND_URL=http://localhost:3000

# Start Next.js backend on port 3000
echo "3. Starting Next.js backend on port 3000..."
PORT=3000 nohup npm run start > backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Check if backend is running
if lsof -i :3000 > /dev/null 2>&1; then
    echo "✅ Next.js backend is running on port 3000"
else
    echo "❌ Failed to start Next.js backend"
    tail -10 backend.log
    exit 1
fi

# Start Python proxy
echo "4. Starting Python RAG proxy on port 8001..."
nohup python3 openwebui-rag-proxy-dynamic.py > proxy.log 2>&1 &
PROXY_PID=$!

# Wait for proxy to start
sleep 5

# Check if proxy is running
if lsof -i :8001 > /dev/null 2>&1; then
    echo "✅ Python RAG proxy is running on port 8001"
else
    echo "❌ Failed to start Python proxy"
    tail -10 proxy.log
fi

# Update nginx to proxy to port 3000
echo "5. Updating nginx configuration..."
echo 'server { 
    listen 80; 
    server_name 212.86.105.190; 
    location / { 
        proxy_pass http://localhost:3000; 
        proxy_set_header Host $host; 
        proxy_set_header X-Real-IP $remote_addr; 
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; 
        proxy_set_header X-Forwarded-Proto $scheme; 
    } 
}' > /etc/nginx/sites-available/default

nginx -t && systemctl reload nginx

echo "6. System Status:"
echo "=== PROCESSES ==="
ps aux | grep -E '(next-server|openwebui-rag-proxy)' | grep -v grep
echo "=== PORTS ==="
netstat -tlnp | grep -E '(3000|8001)'

echo "🎉 Complete system fix finished!"
echo "Next.js Backend: http://localhost:3000"
echo "Python RAG Proxy: http://localhost:8001"
echo "External Access: http://212.86.105.190" 