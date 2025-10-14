module.exports = {
  apps: [{
    name: 'rfp-autonomous',
    script: 'npm',
    args: 'start',
    cwd: '/opt/rfp-autonomous',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 2,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_file: '.env.production',
    log_file: '/var/log/rfp-autonomous.log',
    out_file: '/var/log/rfp-autonomous-out.log',
    error_file: '/var/log/rfp-autonomous-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true,
    
    // Advanced configuration for autonomous system
    node_args: '--max-old-space-size=2048',
    
    // Health check
    health_check: {
      script: './scripts/health-check.js',
      interval: 30000
    },
    
    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 10000,
    
    // Autorestart conditions
    max_restarts: 10,
    min_uptime: '10s'
  }]
};