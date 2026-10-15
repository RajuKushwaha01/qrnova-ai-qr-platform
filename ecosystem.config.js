// IMPORTANT: keep ONE instance. The JSON database has a single writer, so cluster mode would corrupt it.
module.exports = {
  apps: [{
    name: 'qrnova',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '512M',
    kill_timeout: 8000,                 // lets the server flush the database on shutdown
    time: true,
    env: { NODE_ENV: 'production' },
    out_file: 'data/logs/pm2-out.log',
    error_file: 'data/logs/pm2-error.log',
  }],
};