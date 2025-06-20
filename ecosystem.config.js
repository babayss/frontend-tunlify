module.exports = {
  apps: [{
    name: 'tunlify-frontend',
    script: 'npm run start',
    args: 'start',
    cwd: '/home/jony/tunlify-bolt',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/pm2/tunlify-frontend-error.log',
    out_file: '/var/log/pm2/tunlify-frontend-out.log',
    log_file: '/var/log/pm2/tunlify-frontend.log',
    time: true,
    restart_delay: 1000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
