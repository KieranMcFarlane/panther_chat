#!/bin/bash

REMOTE_HOST="212.86.105.190"

echo "🔧 Setting up Yellow Panther AI as a systemd service on port 3217..."

# Copy service file to remote server
scp yellow-panther-3217.service root@$REMOTE_HOST:/etc/systemd/system/

# Enable and start the service
ssh root@$REMOTE_HOST << 'EOF'
systemctl daemon-reload
systemctl enable yellow-panther-3217
systemctl start yellow-panther-3217
systemctl status yellow-panther-3217
EOF

echo ""
echo "✅ Yellow Panther AI service installed!"
echo "🌐 Dashboard: http://$REMOTE_HOST:3217"
echo "🔧 Open WebUI: http://$REMOTE_HOST:3000"
echo ""
echo "📋 Service commands:"
echo "   • Status: ssh root@$REMOTE_HOST 'systemctl status yellow-panther-3217'"
echo "   • Restart: ssh root@$REMOTE_HOST 'systemctl restart yellow-panther-3217'"
echo "   • Logs: ssh root@$REMOTE_HOST 'journalctl -u yellow-panther-3217 -f'" 