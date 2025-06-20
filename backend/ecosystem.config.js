module.exports = {
  apps: [{
    name: 'tunlify-backend',
    script: 'server.js',
    cwd: '/home/jony/tunlify-bolt/backend',
    instances: 1, // Bisa diganti ke 'max' untuk cluster mode
    exec_mode: 'fork', // atau 'cluster' untuk multiple instances
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    // Auto restart options
    watch: false, // Set true untuk auto-restart on file changes
    ignore_watch: ['node_modules', 'logs', '.git'],
    watch_options: {
      followSymlinks: false
    },
    
    // Restart policy
    restart_delay: 1000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Logs
    error_file: '/var/log/pm2/tunlify-backend-error.log',
    out_file: '/var/log/pm2/tunlify-backend-out.log',
    log_file: '/var/log/pm2/tunlify-backend.log',
    time: true,
    
    // Memory management
    max_memory_restart: '500M',
    
    // Environment variables dari .env file
    env_file: '.env'
  }]
};
