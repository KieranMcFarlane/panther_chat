#!/bin/bash

# Fix Ollama Service Script
echo "🔧 Fixing Ollama service on remote server..."

# Create systemd service file for Ollama
cat > /tmp/ollama.service << 'EOF'
[Unit]
Description=Ollama Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt
Environment=OLLAMA_HOST=0.0.0.0:11434
ExecStart=/usr/local/bin/ollama serve
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Upload and configure the service
echo "📁 Uploading systemd service file..."
scp /tmp/ollama.service root@212.86.105.190:/etc/systemd/system/

echo "🔄 Configuring Ollama service..."
ssh root@212.86.105.190 '
    # Stop any existing ollama processes
    killall ollama 2>/dev/null || true
    
    # Reload systemd
    systemctl daemon-reload
    
    # Enable and start the service
    systemctl enable ollama
    systemctl start ollama
    
    # Check status
    echo "=== Service Status ==="
    systemctl status ollama --no-pager
    
    echo "=== Port Check ==="
    sleep 3
    netstat -tlnp | grep 11434 || echo "Port 11434 not found"
    
    echo "=== Process Check ==="
    ps aux | grep ollama | grep -v grep
'

echo "✅ Ollama service configuration complete!"
echo "🧪 Testing external connectivity..."
sleep 5
curl -s http://212.86.105.190:11434/api/tags && echo "✅ Ollama is responding!" || echo "❌ Ollama still not accessible" 