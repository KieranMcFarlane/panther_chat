#!/bin/bash

# Deploy to Existing EC2 Instance (t3.micro optimized)
# This script is optimized for your existing t3.micro instance

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Signal Noise App - Deploy to Existing EC2 (t3.micro)${NC}"
echo -e "${BLUE}=====================================================${NC}"

# Get EC2 details
echo -e "${YELLOW}🔍 Please provide your EC2 instance details:${NC}"
read -p "EC2 Public IP: " EC2_IP
read -p "EC2 Key Pair file path (e.g., ~/.ssh/my-key.pem): " KEY_PATH
read -p "EC2 username (usually 'ec2-user'): " EC2_USER

# Validate inputs
if [ -z "$EC2_IP" ] || [ -z "$KEY_PATH" ] || [ -z "$EC2_USER" ]; then
    echo -e "${RED}❌ All fields are required${NC}"
    exit 1
fi

# Check if key file exists
if [ ! -f "$KEY_PATH" ]; then
    echo -e "${RED}❌ Key file not found: $KEY_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✅ EC2 details captured${NC}"
echo -e "${BLUE}📍 Instance: $EC2_USER@$EC2_IP${NC}"
echo -e "${BLUE}🔑 Key: $KEY_PATH${NC}"

# Create t3.micro optimized deployment package
echo -e "${YELLOW}📦 Creating t3.micro optimized deployment package...${NC}"

DEPLOY_DIR="deployment-t3micro"
rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR

# Copy necessary files
cp -r backend/ $DEPLOY_DIR/
cp requirements.txt $DEPLOY_DIR/
cp Dockerfile $DEPLOY_DIR/
cp env.example $DEPLOY_DIR/

# Create t3.micro optimized docker-compose
cat > $DEPLOY_DIR/docker-compose.t3micro.yml << 'EOF'
version: '3.8'

services:
  # Redis with memory limits for t3.micro
  redis:
    image: redis:7-alpine
    container_name: signal-noise-redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Main application (optimized for t3.micro)
  app:
    build: .
    container_name: signal-noise-app
    ports:
      - "8000:8000"
    environment:
      - NEO4J_URI=${NEO4J_URI}
      - NEO4J_USER=${NEO4J_USER}
      - NEO4J_PASSWORD=${NEO4J_PASSWORD}
      - REDIS_URL=redis://localhost:6379/0
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY}
      - BRIGHTDATA_API_KEY=${BRIGHTDATA_API_KEY}
      - ENVIRONMENT=production
      - WORKER_CONCURRENCY=1
      - MAX_WORKERS=2
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
        reservations:
          memory: 256M
          cpus: '0.5'

  # Single Celery worker (optimized for t3.micro)
  worker:
    build: .
    container_name: signal-noise-worker
    command: ["celery", "-A", "backend.celery_app", "worker", "--loglevel=info", "--concurrency=1", "--max-tasks-per-child=100"]
    environment:
      - NEO4J_URI=${NEO4J_URI}
      - NEO4J_USER=${NEO4J_USER}
      - NEO4J_PASSWORD=${NEO4J_PASSWORD}
      - REDIS_URL=redis://localhost:6379/0
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY}
      - BRIGHTDATA_API_KEY=${BRIGHTDATA_API_KEY}
      - ENVIRONMENT=production
      - WORKER_CONCURRENCY=1
      - MAX_WORKERS=1
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 384M
          cpus: '0.8'
        reservations:
          memory: 192M
          cpus: '0.4'

volumes:
  redis_data:
    driver: local

networks:
  default:
    name: signal-noise-network
EOF

# Create t3.micro optimized deployment script
cat > $DEPLOY_DIR/deploy-t3micro.sh << 'EOF'
#!/bin/bash

echo "🚀 Deploying Signal Noise App on t3.micro..."

# Update system (minimal)
sudo yum update -y --security

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

# Optimize system for t3.micro
echo "⚡ Optimizing system for t3.micro..."

# Increase swap space for memory management
if [ ! -f /swapfile ]; then
    echo "💾 Creating swap file..."
    sudo fallocate -l 1G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# Optimize Docker daemon
sudo tee /etc/docker/daemon.json > /dev/null << 'EOF'
{
    "storage-driver": "overlay2",
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    },
    "default-ulimits": {
        "nofile": {
            "Hard": 64000,
            "Name": "nofile",
            "Soft": 64000
        }
    }
}
EOF

# Restart Docker to apply changes
sudo systemctl restart docker

# Build and start services
echo "🐳 Starting services with Docker Compose (t3.micro optimized)..."
docker-compose -f docker-compose.t3micro.yml up -d

echo "✅ Deployment completed!"
echo "🌐 App should be available at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8000"
echo "📊 Check status with: docker-compose -f docker-compose.t3micro.yml ps"
echo "💾 Memory usage: free -h"
echo "💾 Swap usage: swapon --show"
EOF

chmod +x $DEPLOY_DIR/deploy-t3micro.sh

# Create t3.micro specific README
cat > $DEPLOY_DIR/README-t3micro.md << 'EOF'
# Signal Noise App - t3.micro Deployment

## t3.micro Optimizations

This deployment is specifically optimized for AWS t3.micro instances:

### Resource Limits
- **App Container**: 512MB RAM, 1 vCPU
- **Worker Container**: 384MB RAM, 0.8 vCPU  
- **Redis**: 256MB RAM limit
- **Total**: ~1.1GB RAM usage (within t3.micro limits)

### Performance Optimizations
- Single Celery worker with concurrency=1
- Redis memory limits to prevent OOM
- Swap file for memory management
- Docker daemon optimizations
- Minimal system updates

### Monitoring Commands
```bash
# Check memory usage
free -h
swapon --show

# Check container status
docker-compose -f docker-compose.t3micro.yml ps

# View logs
docker-compose -f docker-compose.t3micro.yml logs -f

# Check system resources
docker stats
```

### Scaling Considerations
- t3.micro is suitable for development/testing
- For production, consider t3.small or t3.medium
- Monitor CPU credits usage
- Set up CloudWatch alarms for resource monitoring
EOF

echo -e "${GREEN}✅ t3.micro optimized package created in: $DEPLOY_DIR${NC}"

# Deploy to existing EC2
echo -e "${YELLOW}🚀 Deploying to your existing EC2 instance...${NC}"

# Upload package
echo -e "${YELLOW}📤 Uploading deployment package...${NC}"
scp -i "$KEY_PATH" -r "$DEPLOY_DIR/" "$EC2_USER@$EC2_IP:~/"

# Deploy on EC2
echo -e "${YELLOW}🔧 Running deployment on EC2...${NC}"
ssh -i "$KEY_PATH" "$EC2_USER@$EC2_IP" << 'EOF'
cd deployment-t3micro
chmod +x deploy-t3micro.sh
./deploy-t3micro.sh
EOF

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${BLUE}📋 Next steps:${NC}"
echo -e "${YELLOW}   1. SSH into your EC2: ssh -i $KEY_PATH $EC2_USER@$EC2_IP${NC}"
echo -e "${YELLOW}   2. Configure environment: cd deployment-t3micro && nano .env${NC}"
echo -e "${YELLOW}   3. Restart services: docker-compose -f docker-compose.t3micro.yml restart${NC}"
echo -e "${YELLOW}   4. Access your app: http://$EC2_IP:8000${NC}"
echo -e ""
echo -e "${BLUE}💰 Cost estimate: ~$8-10/month (well within your $100 credits)${NC}"
echo -e "${BLUE}📊 Monitor with: docker stats${NC}"
