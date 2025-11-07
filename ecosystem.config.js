module.exports = {
  apps: [{
    name: 'tweetbot',
    script: 'scripts/start.js',
    args: '--production',
    watch: false,
    instances: 1,
    autorestart: true,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PATH: process.env.PATH
    },
    env_production: {
      NODE_ENV: 'production'
    },
    // Logging
    out_file: './logs/pm2-out.log',
    error_file: './logs/pm2-error.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
} 