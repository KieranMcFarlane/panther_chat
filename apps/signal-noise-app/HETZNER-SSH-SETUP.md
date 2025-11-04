# 🔐 Setup SSH Access for Hetzner Cloud Server

## Problem
- Password authentication is disabled (Hetzner security default)
- SSH key authentication not working because key isn't on server yet
- Need to add SSH key to server first

## ✅ Solution Options

### Option 1: Use Hetzner Cloud Console (Recommended)

1. **Open Hetzner Cloud Console:**
   - Go to: https://console.hetzner.cloud/
   - Navigate to: **Servers** → Find your server (`ubuntu-4gb-hel1-1`)

2. **Access Web Console:**
   - Click on your server
   - Go to **"Console"** tab
   - This opens a browser-based terminal (no SSH needed!)

3. **Add SSH Key:**
   ```bash
   # Login as root (password: Jnmjrk7iPhKU if needed, or might be key-based)
   
   # Create ubuntu user's .ssh directory
   mkdir -p /home/ubuntu/.ssh
   chmod 700 /home/ubuntu/.ssh
   
   # Add your public key
   echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJE7Y7iEbO85Q/rYvdwdnLvhSnverwv+zyhFowtN2kQF kieranmcfarlane@kidcurrents-Laptop" >> /home/ubuntu/.ssh/authorized_keys
   
   # Set correct permissions
   chmod 600 /home/ubuntu/.ssh/authorized_keys
   chown -R ubuntu:ubuntu /home/ubuntu/.ssh
   
   # Verify
   cat /home/ubuntu/.ssh/authorized_keys
   ```

4. **Test SSH from your local machine:**
   ```bash
   ssh ubuntu@46.62.243.243
   ```

---

### Option 2: Add SSH Key via Hetzner Dashboard

1. **Go to Hetzner Cloud Console:**
   - Navigate to: **Security** → **SSH Keys**

2. **Add Your Public Key:**
   - Click **"Add SSH Key"**
   - Name: `kieranmcfarlane-Laptop`
   - Paste your public key:
     ```
     ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJE7Y7iEbO85Q/rYvdwdnLvhSnverwv+zyhFowtN2kQF kieranmcfarlane@kidcurrents-Laptop
     ```
   - Save

3. **Attach Key to Server:**
   - Go to your server settings
   - Edit server → **SSH Keys** tab
   - Select your key
   - Save

4. **Reboot server** (if needed) to apply changes

---

### Option 3: Enable Password Auth Temporarily (Not Recommended)

If you have access via console, you can temporarily enable password auth:

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Change:
# PasswordAuthentication yes
# PubkeyAuthentication yes

# Restart SSH service
sudo systemctl restart sshd

# Then connect with password
ssh root@46.62.243.243
# Password: Jnmjrk7iPhKU
```

**⚠️ Remember to disable password auth after setup for security!**

---

## 🚀 After SSH Works - Deploy Application

Once SSH is working, deploy with:

```bash
cd apps/signal-noise-app
./deploy-complete.sh
```

Or use the Hetzner-specific script:

```bash
./deploy-hetzner.sh
```

---

## 🔍 Verify Your Local SSH Key

Your key should be at:
- **Private key:** `~/.ssh/id_ed25519`
- **Public key:** `~/.ssh/id_ed25519.pub`

Verify public key matches:
```bash
cat ~/.ssh/id_ed25519.pub
# Should show:
# ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJE7Y7iEbO85Q/rYvdwdnLvhSnverwv+zyhFowtN2kQF kieranmcfarlane@kidcurrents-Laptop
```

---

## ✅ Quick Checklist

- [ ] Access Hetzner Cloud Console
- [ ] Use web console OR add SSH key via dashboard
- [ ] Test SSH connection: `ssh ubuntu@46.62.243.243`
- [ ] Run deployment script
