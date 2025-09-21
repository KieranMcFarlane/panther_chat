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
