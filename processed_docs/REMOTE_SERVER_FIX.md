# 🚀 Remote Server Deployment Fix Guide

## Issue Summary
The remote server at `212.86.105.190` has "next: command not found" error because Node.js dependencies aren't installed.

## 🔧 Automated Fix (Recommended)

Run the automated deployment script:
```bash
./fix-remote-deployment.sh
```

## 🛠️ Manual Fix Steps

If the automated script doesn't work, follow these manual steps:

### 1. Connect to Remote Server
```bash
ssh root@212.86.105.190
```

### 2. Navigate to Project Directory
```bash
cd /opt/yellow-panther-ai
```

### 3. Check Current Status
```bash
# Check if Node.js is installed
node --version
npm --version

# Check project files
ls -la package.json
```

### 4. Install Node.js (if missing)
```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### 5. Install Project Dependencies
```bash
# Install all required packages
npm install

# Or for production only
npm install --production
```

### 6. Verify Next.js Installation
```bash
# Check if Next.js is now available
npx next --version
```

### 7. Stop Existing Services
```bash
# Kill any running processes
pkill -f "next dev" || true
pkill -f "python.*rag" || true
```

### 8. Start Backend Services
```bash
# Start Next.js backend
nohup npm run dev > backend.log 2>&1 &

# Wait a moment for it to start
sleep 5

# Start RAG proxy
nohup python3 openwebui-rag-proxy-dynamic.py > rag-proxy.log 2>&1 &

# Wait for RAG proxy to start
sleep 3
```

### 9. Test Services
```bash
# Test Next.js backend
curl -I http://localhost:3000/api/chat

# Test RAG proxy
curl -I http://localhost:8001/v1/models

# Check process status
ps aux | grep -E "(next|python.*rag)"
```

### 10. Check Logs (if issues)
```bash
# Backend logs
tail -f backend.log

# RAG proxy logs  
tail -f rag-proxy.log

# System logs
journalctl -f
```

## 🌐 Access Points

After successful deployment:

- **Yellow Panther AI**: http://212.86.105.190:3000
- **RAG Proxy API**: http://212.86.105.190:8001
- **Direct Chat API**: http://212.86.105.190:3000/api/chat

## 🏆 Brighton Contacts Ready!

Once the system is running, you can immediately search for:

### Key Decision Makers:
1. **Paul Barber** - Chief Executive (Primary contact)
2. **David Weir** - Technical Director (Technical validation)  
3. **Sam Jewell** - Head of Recruitment (Mobile scouting focus)

### Test Search Commands:
```bash
# Test Brighton search via API
curl -X POST -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Search LinkedIn for Brighton decision makers"}],"model":"gpt-4o-mini"}' \
  http://212.86.105.190:3000/api/chat

# Via RAG proxy
curl -X POST -H "Content-Type: application/json" \
  -d '{"model":"🐆 Yellow Panther RAG + 🤖 GPT-4o Mini","messages":[{"role":"user","content":"Find Brighton & Hove Albion decision makers"}]}' \
  http://212.86.105.190:8001/v1/chat/completions
```

## 🚨 Common Issues & Solutions

### "next: command not found"
- Run: `npm install` in `/opt/yellow-panther-ai`
- Ensure Node.js is installed: `node --version`

### "Permission denied"
- Check file permissions: `chmod +x fix-remote-deployment.sh`
- Ensure you're running as root or with sudo

### "Port already in use"
- Kill existing processes: `pkill -f "next dev"`
- Check what's using the port: `lsof -i :3000`

### "Module not found"
- Clear npm cache: `npm cache clean --force`
- Delete node_modules and reinstall: `rm -rf node_modules && npm install`

### SSH Connection Issues
- Verify SSH keys: `ssh-add -l`
- Test connection: `ssh -v root@212.86.105.190`

## 🎯 Next Steps

1. **Fix Deployment**: Run the automated script or manual steps
2. **Test System**: Verify both APIs are responding
3. **Search Brighton**: Use the ready-to-go Brighton decision maker data
4. **Engage Contacts**: Start with Paul Barber as primary decision maker

**Estimated Fix Time**: 5-10 minutes
**Brighton Engagement**: Ready to start immediately after fix! 🐆 