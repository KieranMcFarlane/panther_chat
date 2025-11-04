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
