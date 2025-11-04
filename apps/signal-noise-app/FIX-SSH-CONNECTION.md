# 🔧 Fix SSH Connection to EC2 Instance

## Current Status
- **Instance ID:** i-01fea6aa56a8bb85b
- **Public IP:** 13.60.60.50
- **Status:** Running
- **Problem:** SSH port 22 timing out

## Solutions

### Solution 1: Fix Security Group (Most Likely)

The instance is blocking SSH on port 22. You need to add an inbound rule.

**Steps:**
1. Go to AWS Console → EC2 → Instances
2. Select instance `i-01fea6aa56a8bb85b`
3. Click on **Security** tab
4. Click on the **Security Group** link
5. Click **Inbound rules** → **Edit inbound rules**
6. Click **Add rule**
7. Configure:
   - **Type:** SSH
   - **Protocol:** TCP
   - **Port range:** 22
   - **Source:** My IP (or `0.0.0.0/0` for testing)
8. Click **Save rules**

**Test connection:**
```bash
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \
  ec2-user@13.60.60.50
```

### Solution 2: Check Instance Key Pair

Verify the PEM file is the correct key pair for this instance:

1. Go to AWS Console → EC2 → Instances
2. Select instance `i-01fea6aa56a8bb85b`
3. Check the **Key pair name** in the **Details** tab
4. Make sure it matches your `yellowpanther.pem` file

If it doesn't match, you need to either:
- Use the correct key pair
- Or launch a new instance with the yellowpanther key pair

### Solution 3: Use AWS Session Manager (if key pair is wrong)

If you can't access with the key pair, use AWS Session Manager:

1. Install AWS Session Manager plugin
2. In AWS Console → EC2 → Instances
3. Select your instance → **Connect** → **Session Manager** tab
4. Click **Connect**

### Solution 4: Check Network ACLs

If Security Groups are correct but still blocked:

1. Go to VPC Console → Network ACLs
2. Find the NACL for VPC `vpc-0d068900b1aeb6bc8`
3. Check **Inbound rules** allow SSH (port 22)

## Alternative: Launch New Instance

If connection issues persist, launch a fresh instance:

```bash
# Launch new EC2 instance with:
# - Key pair: yellowpanther
# - Security Group: Allow SSH (22), HTTP (80), HTTPS (443)
# - Region: eu-north-1
```

Then update `deploy-ec2.sh` with the new IP address.

## Test After Fixing

Once Security Group is updated, test:

```bash
# Basic connection test
ssh -i /Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem \
  ec2-user@13.60.60.50

# If successful, you should see the EC2 welcome message
# Then exit and run deployment:

cd apps/signal-noise-app
./deploy-ec2.sh
```

## Common Issues

### Issue: "Permission denied (publickey)"
- Key file permissions wrong: `chmod 600 yellowpanther.pem`
- Wrong username: Try `ec2-user` (Amazon Linux) or `ubuntu` (Ubuntu)

### Issue: "Connection refused"
- SSH service not running on instance
- Wrong port number

### Issue: "Connection timed out"
- Security Group blocking port 22 ← **Most likely**
- Wrong IP address
- Instance not running

## Quick Security Group Check

Run this AWS CLI command to see current rules:

```bash
aws ec2 describe-security-groups \
  --instance-ids i-01fea6aa56a8bb85b \
  --query 'SecurityGroups[0].IpPermissions' \
  --output table
```

Requires AWS CLI to be installed and configured.


