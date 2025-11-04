# 🖥️ TTYD Terminal Sharing Setup

## 🎯 Overview
TTYD is a command-line tool for sharing your terminal over the web. This setup provides secure terminal access for remote development and collaboration on your Yellow Panther AI system.

## ✨ Features
- **Web-based Terminal**: Access your terminal from any browser
- **Secure Authentication**: Username/password protection
- **Multiple Clients**: Support for up to 5 concurrent connections
- **Real-time Logs**: Monitor service activity
- **Easy Management**: Simple start/stop/restart commands

## 🚀 Quick Start

### 1. **Start TTYD Service**
```bash
./manage-ttyd.sh start
```

### 2. **Access Your Terminal**
Open your browser and navigate to:
```
http://localhost:7681
```

### 3. **Login Credentials**
- **Username**: `admin`
- **Password**: `panther123`

## 🛠️ Management Commands

### Basic Operations
```bash
# Start the service
./manage-ttyd.sh start

# Check status
./manage-ttyd.sh status

# Stop the service
./manage-ttyd.sh stop

# Restart the service
./manage-ttyd.sh restart

# View logs
./manage-ttyd.sh logs

# Configure settings
./manage-ttyd.sh config

# Show help
./manage-ttyd.sh help
```

### Environment Variables
You can customize the behavior using environment variables:

```bash
# Change port
TTYD_PORT=8080 ./manage-ttyd.sh start

# Change credentials
TTYD_CREDENTIALS="username:password" ./manage-ttyd.sh start

# Combine both
TTYD_PORT=8080 TTYD_CREDENTIALS="dev:secret123" ./manage-ttyd.sh start
```

## 🔧 Configuration Options

### Default Settings
- **Port**: 7681
- **Credentials**: admin:panther123
- **Max Clients**: 5
- **Terminal Type**: xterm-256color
- **Origin Check**: Enabled (security)
- **Debug Level**: 7 (verbose logging)

### Custom Configuration
Run the config command to interactively change settings:
```bash
./manage-ttyd.sh config
```

## 🔒 Security Features

### Authentication
- Basic HTTP authentication required
- Username/password protection
- Configurable credentials

### Network Security
- Origin checking enabled
- Maximum client limits
- Debug logging for monitoring

### Access Control
- Localhost binding by default
- Configurable port selection
- Process isolation

## 📱 Browser Support

### Supported Browsers
- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

### Features
- Full terminal emulation
- Copy/paste support
- Responsive design
- Mobile-friendly interface

## 🚨 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check if port is already in use
lsof -i :7681

# Check ttyd installation
ttyd --version

# View error logs
./manage-ttyd.sh logs
```

#### Can't Connect
1. **Verify service is running**: `./manage-ttyd.sh status`
2. **Check port**: Ensure port 7681 is accessible
3. **Check firewall**: Ensure localhost access is allowed
4. **Verify credentials**: Use admin:panther123

#### Performance Issues
1. **Reduce debug level**: Edit the script to change debug level
2. **Limit clients**: Reduce max-clients in the script
3. **Check system resources**: Monitor CPU and memory usage

### Log Files
- **Service Logs**: `/tmp/ttyd.log`
- **PID File**: `/tmp/ttyd.pid`
- **Real-time Monitoring**: `./manage-ttyd.sh logs`

## 🔄 Integration with Yellow Panther AI

### Use Cases
1. **Remote Development**: Access your development environment from anywhere
2. **System Monitoring**: Monitor Neo4j, backend services, and logs
3. **Collaboration**: Share terminal access with team members
4. **Debugging**: Remote troubleshooting and system administration

### Service Management
```bash
# Start all services
./manage-ttyd.sh start
./manage-neoconverse.sh start

# Check all services
./manage-ttyd.sh status
./manage-neoconverse.sh status

# Stop all services
./manage-ttyd.sh stop
./manage-neoconverse.sh stop
```

## 📚 Advanced Usage

### Custom Commands
You can modify the script to run different shells or commands:

```bash
# Run bash instead of zsh
ttyd --port 7681 --credential "admin:panther123" /bin/bash

# Run with custom options
ttyd --port 7681 --credential "admin:panther123" --ssl --ssl-cert cert.pem --ssl-key key.pem /bin/zsh
```

### SSL Configuration
For production use, consider enabling SSL:

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Start with SSL
ttyd --port 7681 --ssl --ssl-cert cert.pem --ssl-key key.pem --credential "admin:panther123" /bin/zsh
```

### Reverse Proxy
For production deployment behind a reverse proxy:

```bash
# Start with base path
ttyd --port 7681 --base-path /terminal --credential "admin:panther123" /bin/zsh
```

## 🎉 Ready to Use!

Your TTYD terminal sharing service is now:
- ✅ **Installed** and ready to use
- ✅ **Configured** with secure defaults
- ✅ **Integrated** with your management scripts
- ✅ **Documented** for easy maintenance

Start sharing your terminal today! 🚀

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the logs: `./manage-ttyd.sh logs`
3. Verify the service status: `./manage-ttyd.sh status`
4. Check the TTYD documentation: https://github.com/tsl0922/ttyd


