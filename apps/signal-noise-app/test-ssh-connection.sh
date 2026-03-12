#!/bin/bash

# 🔐 SSH Connection Test & Troubleshooting Script
# Server: 13.60.60.50 | User: kieranmcfarlane

echo "🔐 SSH Connection Test & Troubleshooting"
echo "======================================="
echo "Server: 13.60.60.50"
echo "User: kieranmcfarlane"
echo "Key: /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem"
echo ""

# Step 1: Check SSH key file and permissions
echo "📋 Step 1: Checking SSH key file..."
KEY_FILE="/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem"

if [ -f "$KEY_FILE" ]; then
    echo "✅ SSH key file exists"
    ls -la "$KEY_FILE"
    
    # Fix permissions if needed
    if [ "$(stat -f %A "$KEY_FILE")" != "600" ]; then
        echo "🔧 Fixing key permissions..."
        chmod 600 "$KEY_FILE"
        echo "✅ Permissions fixed to 600"
    fi
else
    echo "❌ SSH key file not found!"
    exit 1
fi

echo ""

# Step 2: Extract and display public key
echo "📋 Step 2: Public Key Information"
echo "================================="
PUBLIC_KEY="/tmp/public_key.pub"

ssh-keygen -y -f "$KEY_FILE" > "$PUBLIC_KEY"
echo "🔓 Public Key (add this to server's ~/.ssh/authorized_keys):"
echo "------------------------------------------------------------"
cat "$PUBLIC_KEY"
echo "------------------------------------------------------------"
echo ""

# Step 3: Test SSH connection with different methods
echo "📋 Step 3: Testing SSH Connection Methods"
echo "========================================="

# Method 1: Direct connection with verbose output
echo "🔍 Method 1: Direct SSH connection (verbose)..."
ssh -v -i "$KEY_FILE" -o ConnectTimeout=10 -o StrictHostKeyChecking=no kieranmcfarlane@13.60.60.50 "echo 'SUCCESS: Direct connection worked!' && whoami && pwd" 2>&1 | grep -E "(debug1:|Connected to|SUCCESS|Permission denied|Authentication)"

echo ""

# Method 2: Try adding key to ssh-agent
echo "🔍 Method 2: SSH via ssh-agent..."
if ssh-add -l | grep -q "$(ssh-keygen -lf "$KEY_FILE" | awk '{print $2}')"; then
    echo "✅ Key already in ssh-agent"
else
    echo "🔧 Adding key to ssh-agent..."
    ssh-add "$KEY_FILE" 2>/dev/null || echo "⚠️ Could not add key to ssh-agent"
fi

# Try connection with ssh-agent
ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no kieranmcfarlane@13.60.60.50 "echo 'SUCCESS: SSH-agent connection worked!' && whoami" 2>&1 | grep -E "(SUCCESS|Permission denied)"

echo ""

# Step 4: Network connectivity test
echo "📋 Step 4: Network Connectivity Test"
echo "=================================="

# Test if server is reachable on port 22
if nc -z -w5 13.60.60.50 22; then
    echo "✅ Server (13.60.60.50) is reachable on port 22"
else
    echo "❌ Server (13.60.60.50) is NOT reachable on port 22"
    echo "   Check: Server IP, firewall rules, network connectivity"
fi

# Test basic connectivity
ping -c 3 13.60.60.50 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Server responds to ping"
else
    echo "❌ Server does not respond to ping"
fi

echo ""

# Step 5: Server setup instructions
echo "📋 Step 5: Server Setup Instructions"
echo "=================================="
echo "If SSH connection fails, you need to add the public key to the server:"
echo ""
echo "1. Connect to server through alternative method (console, etc.)"
echo "2. Run these commands on the server:"
echo ""
echo "   mkdir -p ~/.ssh"
echo "   chmod 700 ~/.ssh"
echo "   echo 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDFk/gYN4Sm8dKEE9NHFiAwlNF6G+ppEZ9rfb7hcmLU5oDGlQrR6xhzQ8ShFc1oBaHcrk+kTt/TzBI6eKKNUaZ21HiLn3EjBpJ92kEDrSRgT+9rQW8JRxhTIbqhYFUEMa5PKF+rKxA3iK94ccK/9F2AohXIo29gGpWoqItfDGHyc3ZzJk7H5cKFf6MYEuukW3rBS0dYzhGhcHdRWcJ5PrKtCGtdqNcgXYBKUxgF5NldUoxm82GN4+rHj9oyepanzaRmSR6C45Wa7ozb2rTe85ovaldeV5wmOtBBEn/amELnmBpibRnplBQr9sreLGIBhW9SnWxuCYBDp54w9BCrF5Dr' >> ~/.ssh/authorized_keys"
echo "   chmod 600 ~/.ssh/authorized_keys"
echo ""
echo "3. Test SSH connection from this machine again"
echo ""

# Step 6: Alternative deployment methods
echo "📋 Step 6: Alternative Deployment Methods"
echo "======================================="
echo ""
echo "📁 Method A: SCP File Transfer"
echo "-------------------------------"
echo "If SSH works for file transfer but not interactive shell:"
echo ""
echo "   scp -i $KEY_FILE production-deploy/* kieranmcfarlane@13.60.60.50:/tmp/"
echo "   ssh -i $KEY_FILE kieranmcfarlane@13.60.60.50 'chmod +x /tmp/deploy-production.sh && /tmp/deploy-production.sh'"
echo ""
echo "📁 Method B: Git-based Deployment"
echo "---------------------------------"
echo "Deploy via git repository (requires git on server):"
echo ""
echo "   # On server:"
echo "   cd /opt"
echo "   git clone <your-repo-url> rfp-autonomous"
echo "   cd rfp-autonomous"
echo "   npm install && npm run build"
echo "   npm run deploy:prod"
echo ""
echo "📁 Method C: Manual Upload"
echo "--------------------------"
echo "1. Use SFTP or web interface to upload files"
echo "2. Access server console to run deployment"
echo "3. Follow manual deployment steps"
echo ""

# Step 7: Quick connection test
echo "📋 Step 7: Final Connection Test"
echo "==============================="
echo "Attempting final connection test..."

if ssh -i "$KEY_FILE" -o ConnectTimeout=5 -o StrictHostKeyChecking=no kieranmcfarlane@13.60.60.50 "echo '🎉 SSH CONNECTION SUCCESSFUL!'" 2>/dev/null; then
    echo "✅ SSH connection successful!"
    echo ""
    echo "🚀 Ready for deployment! Run:"
    echo "   ssh -i $KEY_FILE kieranmcfarlane@13.60.60.50 'sudo bash /tmp/deploy-production.sh'"
else
    echo "❌ SSH connection still failing"
    echo ""
    echo "📞 Next steps:"
    echo "1. Add public key to server (see Step 5)"
    echo "2. Check server SSH configuration"
    echo "3. Verify network connectivity"
    echo "4. Try alternative deployment methods (see Step 6)"
    echo ""
    echo "📖 Historical deployment guide: legacy/neo4j/docs/DEPLOYMENT-GUIDE.md"
fi

echo ""
echo "🔍 SSH Key Fingerprint:"
ssh-keygen -lf "$KEY_FILE"
echo ""
echo "📋 Script completed at $(date)"
