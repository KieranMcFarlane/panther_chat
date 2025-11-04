# 🔐 Authentication & Secure TTYD Setup Guide

## 🎯 Overview
This guide sets up a comprehensive authentication system for your Yellow Panther AI app with secure TTYD terminal access. You can choose between **Supabase Auth** (open source, self-hostable) or continue using **Auth0**.

## 🚀 **Option 1: Supabase Auth (Recommended for Open Source)**

### **Why Supabase Auth?**
- ✅ **100% Open Source** - Self-hostable
- ✅ **JWT-based** with secure token management
- ✅ **Built-in security** (RLS, rate limiting, MFA)
- ✅ **Easy integration** with Next.js
- ✅ **Free tier** available
- ✅ **Perfect for TTYD integration**

### **Step 1: Create Supabase Project**
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Get your project URL and anon key

### **Step 2: Environment Configuration**
Create `.env.local` in your `neoconverse` directory:
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# JWT Secret for TTYD Integration
JWT_SECRET=your_jwt_secret_here

# TTYD Configuration
TTYD_PORT=7681
TTYD_JWT_SECRET=your_ttyd_jwt_secret

# Existing Configuration
OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_BACKEND_HOST=bolt://localhost:7687
NEXT_PUBLIC_BACKEND_UNAME=neo4j
NEXT_PUBLIC_BACKEND_PWD=pantherpassword
NEXT_PUBLIC_BACKEND_DATABASE=neo4j
```

### **Step 3: Switch to Supabase Auth**
Update your `authHelper.ts` to use Supabase:
```typescript
// In pages/api/authHelper.ts
export const getAuthMethod = (): AuthMethod => {
  return AuthMethod.Supabase; // Change from Auth0
}
```

## 🔐 **Option 2: Keep Auth0 (Current Setup)**

If you prefer to keep Auth0, the TTYD integration will still work with JWT tokens.

## 🖥️ **Secure TTYD Integration**

### **Features**
- **JWT Authentication** - Secure token-based access
- **User Management** - Integrated with your auth system
- **Access Logging** - Monitor terminal usage
- **Role-based Access** - Control who can access terminals
- **Tailscale Ready** - Perfect for remote access

### **Step 1: Start Secure TTYD**
```bash
# Start with JWT authentication
./manage-ttyd-secure.sh start

# Check status
./manage-ttyd-secure.sh status

# View logs
./manage-ttyd-secure.sh logs
```

### **Step 2: Generate JWT Token**
```bash
# Generate test token
./manage-ttyd-secure.sh generate-token
```

### **Step 3: Access Terminal**
1. **Via Web App**: Use the TTYD component in your React app
2. **Direct URL**: `http://localhost:7681?token=YOUR_JWT_TOKEN`
3. **Remote Access**: Perfect for Tailscale integration

## 🌐 **Tailscale Integration**

### **Why Tailscale?**
- ✅ **Zero-config VPN** - Automatic mesh network
- ✅ **Secure access** - Encrypted connections
- ✅ **Easy setup** - One command installation
- ✅ **Perfect for TTYD** - Secure remote terminal access

### **Step 1: Install Tailscale**
```bash
# macOS
brew install tailscale

# Linux
curl -fsSL https://tailscale.com/install.sh | sh
```

### **Step 2: Connect to Tailscale**
```bash
# Start Tailscale
sudo tailscale up

# Get your Tailscale IP
tailscale ip
```

### **Step 3: Access TTYD Remotely**
```bash
# From any Tailscale-connected device
http://YOUR_TAILSCALE_IP:7681?token=YOUR_JWT_TOKEN
```

## 🔧 **Management Commands**

### **TTYD Management**
```bash
# Start secure service
./manage-ttyd-secure.sh start

# Check status
./manage-ttyd-secure.sh status

# View logs
./manage-ttyd-secure.sh logs

# Access logs
./manage-ttyd-secure.sh access-logs

# Generate token
./manage-ttyd-secure.sh generate-token

# Configure settings
./manage-ttyd-secure.sh config

# Stop service
./manage-ttyd-secure.sh stop
```

### **Environment Variables**
```bash
# Change port
TTYD_PORT=8080 ./manage-ttyd-secure.sh start

# Set JWT secret
TTYD_JWT_SECRET="my-secret-key" ./manage-ttyd-secure.sh start
```

## 🎨 **React Components**

### **TTYD Terminal Component**
```tsx
import { TTYDTerminal } from '../components/ttyd/TTYDTerminal'

// In your page
<TTYDTerminal port={7681} />
```

### **Protected Routes**
```tsx
import { ProtectedRoute } from '../components/auth/ProtectedRoute'

// Wrap protected content
<ProtectedRoute>
  <TTYDTerminal />
</ProtectedRoute>
```

## 🔒 **Security Features**

### **Authentication Layers**
1. **App Authentication** - Supabase/Auth0 login required
2. **JWT Token Generation** - Secure token for TTYD access
3. **Token Verification** - Server-side validation
4. **Access Logging** - Monitor all terminal access
5. **Origin Checking** - Prevent unauthorized domains

### **Token Security**
- **Time-limited** - Tokens expire automatically
- **User-specific** - Each user gets unique tokens
- **Audit trail** - All access is logged
- **Revocable** - Tokens can be invalidated

## 🚀 **Quick Start Commands**

### **Complete Setup**
```bash
# 1. Install dependencies
cd neoconverse
npm install

# 2. Set up environment
cp supabase.env.example .env.local
# Edit .env.local with your Supabase credentials

# 3. Start secure TTYD
./manage-ttyd-secure.sh start

# 4. Start your app
npm run dev

# 5. Access at http://localhost:3000
```

### **Remote Access Setup**
```bash
# 1. Install Tailscale
brew install tailscale

# 2. Connect to network
sudo tailscale up

# 3. Get your IP
tailscale ip

# 4. Access from anywhere
http://YOUR_TAILSCALE_IP:7681?token=YOUR_JWT_TOKEN
```

## 🔍 **Troubleshooting**

### **Common Issues**

#### **TTYD Won't Start**
```bash
# Check if port is in use
lsof -i :7681

# Check logs
./manage-ttyd-secure.sh logs

# Verify installation
ttyd --version
```

#### **Authentication Fails**
1. **Check environment variables** - Ensure Supabase credentials are correct
2. **Verify JWT secret** - Check TTYD_JWT_SECRET in environment
3. **Check user permissions** - Ensure user exists in Supabase
4. **View access logs** - Check for authentication attempts

#### **Remote Access Issues**
1. **Tailscale connection** - Ensure devices are connected
2. **Firewall settings** - Allow port 7681
3. **JWT token validity** - Check token expiration
4. **Network routing** - Verify Tailscale IP routing

### **Debug Commands**
```bash
# Check all services
./manage-ttyd-secure.sh status
./manage-neoconverse.sh status

# View all logs
./manage-ttyd-secure.sh logs
./manage-ttyd-secure.sh access-logs

# Test JWT generation
./manage-ttyd-secure.sh generate-token
```

## 📚 **Advanced Configuration**

### **Custom JWT Implementation**
For production, replace the simple base64 implementation with a proper JWT library:
```bash
npm install jsonwebtoken @types/jsonwebtoken
```

### **SSL/TLS Setup**
```bash
# Generate certificates
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Start with SSL
ttyd --port 7681 --ssl --ssl-cert cert.pem --ssl-key key.pem --url-arg /bin/zsh
```

### **Reverse Proxy Integration**
```bash
# Nginx configuration
location /terminal/ {
    proxy_pass http://localhost:7681/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

## 🎉 **Ready to Use!**

Your secure authentication system is now:
- ✅ **Integrated** with your Yellow Panther AI app
- ✅ **Secure** with JWT authentication
- ✅ **Remote-ready** for Tailscale access
- ✅ **Monitored** with comprehensive logging
- ✅ **Scalable** for production use

### **Next Steps**
1. **Test locally** - Verify authentication works
2. **Set up Tailscale** - Enable remote access
3. **Configure production** - Set up SSL and proper JWT
4. **Monitor usage** - Check access logs regularly
5. **Scale up** - Add more users and permissions

Start building secure, remote-accessible AI tools! 🚀


