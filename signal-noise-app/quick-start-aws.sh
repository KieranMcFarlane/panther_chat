#!/bin/bash

# Quick Start AWS Deployment for Signal Noise App
# This script immediately prepares everything for AWS deployment

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Signal Noise App - Quick Start AWS Deployment${NC}"
echo -e "${BLUE}================================================${NC}"

# Check if we're in the right directory
if [ ! -f "backend/main.py" ]; then
    echo -e "${RED}❌ Please run this script from the signal-noise-app directory${NC}"
    exit 1
fi

# Create deployment package immediately
echo -e "${YELLOW}📦 Creating deployment package...${NC}"
./deploy-ec2-simple.sh

# Show next steps
echo -e "${GREEN}🎉 Quick setup completed!${NC}"
echo -e "${BLUE}📋 Your next steps:${NC}"
echo -e ""
echo -e "${YELLOW}1. 🖥️  Launch EC2 Instance on AWS:${NC}"
echo -e "   - Go to AWS Console → EC2 → Launch Instance"
echo -e "   - Choose Amazon Linux 2 AMI"
echo -e "   - Select t3.medium instance type"
echo -e "   - Create/select a key pair"
echo -e "   - Configure security group:"
echo -e "     • SSH (22): 0.0.0.0/0"
echo -e "     • Custom TCP (8000): 0.0.0.0/0"
echo -e "   - Launch instance"
echo -e ""
echo -e "${YELLOW}2. 📤 Upload to EC2:${NC}"
echo -e "   scp -i your-key.pem -r deployment-package/ ec2-user@YOUR-EC2-IP:~/"
echo -e ""
echo -e "${YELLOW}3. 🔧 Deploy on EC2:${NC}"
echo -e "   ssh -i your-key.pem ec2-user@YOUR-EC2-IP"
echo -e "   cd deployment-package"
echo -e "   ./deploy.sh"
echo -e ""
echo -e "${YELLOW}4. ⚙️  Configure environment:${NC}"
echo -e "   nano .env"
echo -e "   # Edit with your actual API keys and configuration"
echo -e ""
echo -e "${YELLOW}5. 🚀 Restart and access:${NC}"
echo -e "   docker-compose -f docker-compose.prod.yml down"
echo -e "   docker-compose -f docker-compose.prod.yml up -d"
echo -e "   # Access at: http://YOUR-EC2-IP:8000"
echo -e ""
echo -e "${BLUE}📚 For detailed instructions, see: AWS_SETUP_GUIDE.md${NC}"
echo -e "${BLUE}🐳 For advanced deployment options, run: ./deploy-aws.sh${NC}"
echo -e ""
echo -e "${GREEN}✅ You're ready to deploy to AWS!${NC}"
