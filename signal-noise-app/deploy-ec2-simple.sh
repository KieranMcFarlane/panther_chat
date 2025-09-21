#!/bin/bash

# Simple EC2 Deployment Script for Signal Noise App
# This script helps you quickly deploy to an existing EC2 instance

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Signal Noise App - Simple EC2 Deployment${NC}"
echo -e "${BLUE}============================================${NC}"

# Check if required tools are installed
check_requirements() {
    echo -e "${YELLOW}🔍 Checking requirements...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${YELLOW}⚠️  Docker not found locally - will install on EC2${NC}"
    else
        echo -e "${GREEN}✅ Docker found locally${NC}"
    fi
    
    if ! command -v aws &> /dev/null; then
        echo -e "${YELLOW}⚠️  AWS CLI not found - will need manual EC2 setup${NC}"
    else
        echo -e "${GREEN}✅ AWS CLI found${NC}"
    fi
}

# Create deployment package
create_deployment_package() {
    echo -e "${YELLOW}📦 Creating deployment package...${NC}"
    
    # Create deployment directory
    DEPLOY_DIR="deployment-package"
    rm -rf $DEPLOY_DIR
    mkdir -p $DEPLOY_DIR
    
    # Copy necessary files
    cp -r backend/ $DEPLOY_DIR/
    cp requirements.txt $DEPLOY_DIR/
    cp docker-compose.prod.yml $DEPLOY_DIR/
    cp Dockerfile $DEPLOY_DIR/
    cp env.example $DEPLOY_DIR/
    
    # Create deployment script
    cat > $DEPLOY_DIR/deploy.sh << 'EOF'
#!/bin/bash

echo "🚀 Deploying Signal Noise App..."

# Update system
sudo yum update -y

# Install Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    sudo yum install -y docker
    sudo service docker start
    sudo usermod -a -G docker ec2-user
    sudo systemctl enable docker
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Create .env file from example
if [ ! -f .env ]; then
    echo "⚙️  Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your actual configuration values"
fi

# Build and start services
echo "🐳 Starting services with Docker Compose..."
docker-compose -f docker-compose.prod.yml up -d

echo "✅ Deployment completed!"
echo "🌐 App should be available at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8000"
echo "📊 Check status with: docker-compose -f docker-compose.prod.yml ps"
EOF
    
    chmod +x $DEPLOY_DIR/deploy.sh
    
    # Create README
    cat > $DEPLOY_DIR/README.md << 'EOF'
# Signal Noise App - EC2 Deployment

## Quick Start

1. **Upload files to EC2:**
   ```bash
   scp -i your-key.pem -r deployment-package/ ec2-user@your-ec2-ip:~/
   ```

2. **SSH into EC2:**
   ```bash
   ssh -i your-key.pem ec2-user@your-ec2-ip
   ```

3. **Deploy:**
   ```bash
   cd deployment-package
   ./deploy.sh
   ```

4. **Configure environment:**
   ```bash
   nano .env
   # Edit with your actual API keys and configuration
   ```

5. **Restart services:**
   ```bash
   docker-compose -f docker-compose.prod.yml down
   docker-compose -f docker-compose.prod.yml up -d
   ```

## Configuration

Edit the `.env` file with your:
- Neo4j AuraDB credentials
- API keys (Claude, Perplexity, Bright Data)
- Redis password
- Other environment-specific settings

## Monitoring

- Check service status: `docker-compose -f docker-compose.prod.yml ps`
- View logs: `docker-compose -f docker-compose.prod.yml logs -f`
- Health check: `curl http://localhost:8000/health`

## Security

- Update security group to only allow necessary ports (22, 8000)
- Use strong passwords for Redis and databases
- Consider using AWS Secrets Manager for sensitive data
EOF
    
    echo -e "${GREEN}✅ Deployment package created in: $DEPLOY_DIR${NC}"
}

# Create AWS setup guide
create_aws_guide() {
    echo -e "${YELLOW}📚 Creating AWS setup guide...${NC}"
    
    cat > AWS_SETUP_GUIDE.md << 'EOF'
# AWS Setup Guide for Signal Noise App

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured with credentials
3. **EC2 Key Pair** for SSH access

## Step 1: Launch EC2 Instance

### Using AWS Console:
1. Go to EC2 Dashboard
2. Click "Launch Instance"
3. Choose "Amazon Linux 2 AMI"
4. Select instance type: `t3.medium` (recommended)
5. Configure security group:
   - SSH (22): 0.0.0.0/0 (or your IP)
   - Custom TCP (8000): 0.0.0.0/0
   - Custom TCP (6379): 10.0.0.0/16 (for Redis)
6. Launch instance and download key pair

### Using AWS CLI:
```bash
# Create security group
aws ec2 create-security-group \
    --group-name signal-noise-sg \
    --description "Security group for Signal Noise App"

# Add inbound rules
aws ec2 authorize-security-group-ingress \
    --group-name signal-noise-sg \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
    --group-name signal-noise-sg \
    --protocol tcp \
    --port 8000 \
    --cidr 0.0.0.0/0

# Launch instance (replace with your key pair name)
aws ec2 run-instances \
    --image-id ami-0c02fb55956c7d316 \
    --count 1 \
    --instance-type t3.medium \
    --key-name your-key-pair-name \
    --security-group-ids signal-noise-sg
```

## Step 2: Deploy Application

1. **Upload deployment package:**
   ```bash
   scp -i your-key.pem -r deployment-package/ ec2-user@your-ec2-ip:~/
   ```

2. **SSH into instance:**
   ```bash
   ssh -i your-key.pem ec2-user@your-ec2-ip
   ```

3. **Run deployment:**
   ```bash
   cd deployment-package
   ./deploy.sh
   ```

## Step 3: Configure Environment

1. **Edit .env file:**
   ```bash
   nano .env
   ```

2. **Set your configuration:**
   ```bash
   NEO4J_URI=neo4j+s://your-aura-instance.databases.neo4j.io
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=your-password
   CLAUDE_API_KEY=your-claude-key
   PERPLEXITY_API_KEY=your-perplexity-key
   BRIGHTDATA_API_KEY=your-brightdata-key
   REDIS_PASSWORD=your-redis-password
   ```

3. **Restart services:**
   ```bash
   docker-compose -f docker-compose.prod.yml down
   docker-compose -f docker-compose.prod.yml up -d
   ```

## Step 4: Verify Deployment

1. **Check service status:**
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   ```

2. **Test health endpoint:**
   ```bash
   curl http://localhost:8000/health
   ```

3. **Access from browser:**
   ```
   http://your-ec2-public-ip:8000
   ```

## Optional: Domain and SSL

1. **Route 53** for domain management
2. **Application Load Balancer** for SSL termination
3. **ACM** for SSL certificates
4. **CloudFront** for CDN

## Monitoring and Logging

1. **CloudWatch** for metrics and logs
2. **CloudTrail** for API logging
3. **X-Ray** for tracing (if needed)

## Cost Optimization

- Use **Spot Instances** for development
- **Reserved Instances** for production
- **Auto Scaling** based on demand
- **S3** for static assets
- **RDS** for managed databases (if migrating from SQLite)

## Security Best Practices

1. **IAM Roles** instead of access keys
2. **VPC** with private subnets
3. **Security Groups** with minimal access
4. **WAF** for web application firewall
5. **Secrets Manager** for sensitive data
6. **CloudTrail** for audit logging
EOF
    
    echo -e "${GREEN}✅ AWS setup guide created: AWS_SETUP_GUIDE.md${NC}"
}

# Main function
main() {
    check_requirements
    create_deployment_package
    create_aws_guide
    
    echo -e "${GREEN}🎉 Setup completed successfully!${NC}"
    echo -e "${BLUE}📁 Files created:${NC}"
    echo -e "${YELLOW}   - deployment-package/ (ready to upload to EC2)${NC}"
    echo -e "${YELLOW}   - AWS_SETUP_GUIDE.md (comprehensive setup guide)${NC}"
    echo -e "${BLUE}📋 Next steps:${NC}"
    echo -e "${YELLOW}   1. Launch EC2 instance on AWS${NC}"
    echo -e "${YELLOW}   2. Upload deployment-package to EC2${NC}"
    echo -e "${YELLOW}   3. Run ./deploy.sh on EC2${NC}"
    echo -e "${YELLOW}   4. Configure your .env file${NC}"
    echo -e "${YELLOW}   5. Access your app at http://ec2-ip:8000${NC}"
}

# Run main function
main "$@"
