#!/bin/bash

echo "🔧 Setting up persistent services for Dynamic Model System..."

# Create systemd service for Ollama
cat > /tmp/ollama.service << 'EOF'
[Unit]
Description=Ollama Service
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/ollama serve
Restart=always
RestartSec=10
Environment=OLLAMA_HOST=0.0.0.0:11434
Environment=OLLAMA_MODELS=/root/.ollama/models

[Install]
WantedBy=multi-user.target
EOF

# Create systemd service for Dynamic RAG Proxy
cat > /tmp/dynamic-rag-proxy.service << 'EOF'
[Unit]
Description=Dynamic RAG Proxy
After=network.target ollama.service
Requires=ollama.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/DYNAMIC_MODEL_SETUP/dynamic-rag-proxy
ExecStart=/usr/bin/python3 app.py
Restart=always
RestartSec=10
Environment=OPENAI_API_KEY=your_openai_api_key_here

[Install]
WantedBy=multi-user.target
EOF

echo "📁 Created service files in /tmp/"
echo "🚀 To install on remote server, run:"
echo "scp /tmp/*.service root@212.86.105.190:/etc/systemd/system/"
echo "ssh root@212.86.105.190 'systemctl daemon-reload && systemctl enable ollama dynamic-rag-proxy && systemctl start ollama dynamic-rag-proxy'" 