# 🔐 Setup SSH Access for Hetzner Server

## Quick Setup

Since your public key matches but isn't accepted, you need to add it to the server first.

### Option 1: Connect as root and add the key

1. **Connect as root with password:**
```bash
ssh root@46.62.243.243
# Password: Jnmjrk7iPhKU
```

2. **Add your SSH key to ubuntu user:**
```bash
# Create ubuntu user's .ssh directory if needed
mkdir -p /home/ubuntu/.ssh
chmod 700 /home/ubuntu/.ssh

# Add your public key
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJE7Y7iEbO85Q/rYvdwdnLvhSnverwv+zyhFowtN2kQF kieranmcfarlane@kidcurrents-Laptop" >> /home/ubuntu/.ssh/authorized_keys

# Set correct permissions
chmod 600 /home/ubuntu/.ssh/authorized_keys
chown -R ubuntu:ubuntu /home/ubuntu/.ssh

# Test connection
exit
```

3. **Now test SSH as ubuntu:**
```bash
ssh ubuntu@46.62.243.243
# Should work without password now
```

### Option 2: Use password-based deployment (temporary)

If you want to deploy now without setting up keys, the deploy script will prompt for password.

## After SSH is working, deploy:

```bash
cd apps/signal-noise-app
./deploy-hetzner.sh
```

Or use the full deployment script:
```bash
./deploy-complete.sh
```
