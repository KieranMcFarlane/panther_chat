#!/bin/bash

# VPS Connection Test and IP Discovery
# Usage: ./test-vps-connection.sh [VPS_IP] [VPS_USER]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VPS_IP=${1:-""}
VPS_USER=${2:-"root"}
PEM_FILE="/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem"

echo -e "${BLUE}🔍 VPS Connection Test and Setup${NC}"
echo "=" * 50

if [ -z "$VPS_IP" ]; then
    echo -e "${YELLOW}No VPS IP provided. Let's discover your VPS details...${NC}"
    echo ""
    echo -e "${BLUE}If you know your VPS IP, run:${NC}"
    echo -e "${YELLOW}./test-vps-connection.sh YOUR_VPS_IP${NC}"
    echo ""
    echo -e "${BLUE}Common ways to find your VPS IP:${NC}"
    echo -e "• Check your VPS provider's dashboard"
    echo -e "• Look for 'Public IP' or 'IPv4 Address'"
    echo -e "• Check your hosting provider's email"
    echo ""
    exit 0
fi

echo -e "${BLUE}VPS IP:${NC} $VPS_IP"
echo -e "${BLUE}VPS User:${NC} $VPS_USER"
echo -e "${BLUE}PEM File:${NC} $PEM_FILE"
echo "=" * 50

# Check if PEM file exists
if [ ! -f "$PEM_FILE" ]; then
    echo -e "${RED}❌ PEM file not found: $PEM_FILE${NC}"
    exit 1
fi

# Set PEM file permissions
chmod 600 "$PEM_FILE"

# Test SSH connection
echo -e "${BLUE}🔌 Testing SSH connection...${NC}"
if ssh -i "$PEM_FILE" -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" "echo 'SSH connection successful'"; then
    echo -e "${GREEN}✅ SSH connection successful${NC}"
else
    echo -e "${RED}❌ Failed to connect to VPS${NC}"
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo -e "  • Verify VPS IP: $VPS_IP"
    echo -e "  • Check if VPS is running"
    echo -e "  • Verify user: $VPS_USER"
    echo -e "  • Check PEM file: $PEM_FILE"
    exit 1
fi

# Get VPS information
echo -e "${BLUE}📊 Gathering VPS Information...${NC}"
VPS_INFO=$(ssh -i "$PEM_FILE" "$VPS_USER@$VPS_IP" << 'EOF'
    echo "OS_INFO: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
    echo "PYTHON_VERSION: $(python3 --version 2>/dev/null || echo 'Not installed')"
    echo "PIP_VERSION: $(pip3 --version 2>/dev/null || echo 'Not installed')"
    echo "MEMORY_INFO: $(free -h | grep Mem | awk '{print $2}' | tr -d '\n')"
    echo "DISK_SPACE: $(df -h / | tail -1 | awk '{print $4}' | tr -d '\n')"
    echo "UPTIME: $(uptime -p 2>/dev/null || echo 'Unknown')"
EOF
)

# Parse and display VPS information
echo ""
echo -e "${BLUE}🖥️  VPS Specifications:${NC}"
while IFS= read -r line; do
    case "$line" in
        OS_INFO:*)
            echo -e "  • Operating System: ${GREEN}${line#OS_INFO: }${NC}"
            ;;
        PYTHON_VERSION:*)
            echo -e "  • Python Version: ${GREEN}${line#PYTHON_VERSION: }${NC}"
            ;;
        PIP_VERSION:*)
            echo -e "  • Pip Version: ${GREEN}${line#PIP_VERSION: }${NC}"
            ;;
        MEMORY_INFO:*)
            echo -e "  • Available Memory: ${GREEN}${line#MEMORY_INFO: }${NC}"
            ;;
        DISK_SPACE:*)
            echo -e "  • Available Disk: ${GREEN}${line#DISK_SPACE: }${NC}"
            ;;
        UPTIME:*)
            echo -e "  • System Uptime: ${GREEN}${line#UPTIME: }${NC}"
            ;;
    esac
done <<< "$VPS_INFO"

# Get public IP
VPS_PUBLIC_IP=$(ssh -i "$PEM_FILE" "$VPS_USER@$VPS_IP" "curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo 'Unknown'")

echo ""
echo -e "${BLUE}🌐 Network Information:${NC}"
echo -e "  • Public IP: ${GREEN}$VPS_PUBLIC_IP${NC}"
echo -e "  • SSH IP: ${GREEN}$VPS_IP${NC}"

# Check if required ports are available
echo ""
echo -e "${BLUE}🔍 Checking Port Availability...${NC}"

# Check if port 8001 is available
PORT_CHECK=$(ssh -i "$PEM_FILE" "$VPS_USER@$VPS_IP" "netstat -tuln 2>/dev/null | grep :8001 || echo 'Port available'")
if [[ "$PORT_CHECK" == *"8001"* ]]; then
    echo -e "  • Port 8001: ${RED}Already in use${NC}"
    echo -e "    ${YELLOW}You may need to stop existing service or use a different port${NC}"
else
    echo -e "  • Port 8001: ${GREEN}Available${NC}"
fi

# Check firewall status
FIREWALL_STATUS=$(ssh -i "$PEM_FILE" "$VPS_USER@$VPS_IP" "sudo ufw status 2>/dev/null || echo 'UFW not available'")
echo -e "  • Firewall: ${GREEN}${FIREWALL_STATUS}${NC}"

# Installation recommendations
echo ""
echo -e "${BLUE}💡 Recommendations:${NC}"

RECOMMENDATIONS=""

# Check Python
if [[ "$VPS_INFO" == *"Not installed"* ]]; then
    RECOMMENDATIONS="$RECOMMENDATIONS
• Install Python 3.8+ (script will handle this automatically)"
fi

# Check available disk space
AVAILABLE_SPACE=$(echo "$VPS_INFO" | grep "DISK_SPACE:" | cut -d' ' -f2 | tr -d 'G')
if [[ "${AVAILABLE_SPACE%.*}" -lt 2 ]]; then
    RECOMMENDATIONS="$RECOMMENDATIONS
• Low disk space available. Consider cleaning up or upgrading storage."
fi

# Check memory
AVAILABLE_MEMORY=$(echo "$VPS_INFO" | grep "MEMORY_INFO:" | cut -d' ' -f2)
if [[ "$AVAILABLE_MEMORY" == *"M"* ]]; then
    MEMORY_MB=$(echo "$AVAILABLE_MEMORY" | tr -d 'M')
    if [[ "${MEMORY_MB%.*}" -lt 512 ]]; then
        RECOMMENDATIONS="$RECOMMENDATIONS
• Low memory available. Consider upgrading RAM for better performance."
    fi
fi

if [ -n "$RECOMMENDATIONS" ]; then
    echo -e "$RECOMMENDATIONS"
else
    echo -e "  ${GREEN}✅ VPS looks ready for deployment!${NC}"
fi

# Next steps
echo ""
echo -e "${BLUE}🚀 Ready to Deploy!${NC}"
echo ""
echo -e "${YELLOW}To deploy the backend to your VPS, run:${NC}"
echo -e "${GREEN}./deploy-to-vps.sh $VPS_IP${NC}"
echo ""
echo -e "${YELLOW}After deployment, configure Next.js:${NC}"
echo -e "${GREEN}./configure-for-vps.sh $VPS_IP${NC}"
echo ""
echo -e "${YELLOW}Your deployed backend will be available at:${NC}"
echo -e "${GREEN}http://$VPS_IP:8001${NC}"
echo ""

# Save VPS info for later use
cat > "vps-config.txt" << EOF
# VPS Configuration - Generated on $(date)
VPS_IP=$VPS_IP
VPS_USER=$VPS_USER
PEM_FILE=$PEM_FILE
VPS_PUBLIC_IP=$VPS_PUBLIC_IP
BACKEND_URL=http://$VPS_IP:8001
HEALTH_CHECK_URL=http://$VPS_IP:8001/health
WEBHOOK_URL=http://$VPS_IP:8001/webhook/chat

# Commands:
# Deploy: ./deploy-to-vps.sh $VPS_IP
# Configure: ./configure-for-vps.sh $VPS_IP
# Test: node test-vps-connection.js
EOF

echo -e "${BLUE}📁 Configuration saved to: ${GREEN}vps-config.txt${NC}"
echo -e "${BLUE}   You can use this file for reference or source it later.${NC}"