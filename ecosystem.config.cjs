require('dotenv').config();
const path = require('node:path');

const common = {
  cwd: __dirname,
  instances: 1,
  exec_mode: 'fork',
  watch: false,
  merge_logs: true,
  time: true,
  max_memory_restart: process.env.PM2_MAX_MEMORY || '1G',
};

module.exports = {
  apps: [
    {
      ...common,
      name: 'secureasset',
      script: 'scripts/start-after-migrations.js',
      args: ['server/src/server.js'],
      node_args: '--enable-source-maps',
      autorestart: true,
      kill_timeout: 16_000,
      // PM2 owns process supervision only. Deployment verifies the real HTTP
      // health endpoint, avoiding IPC ready-signal races in wrapper scripts.
      listen_timeout: 0,
      wait_ready: false,
      exp_backoff_restart_delay: 250,
      error_file: path.join(__dirname, 'logs', 'pm2-error.log'),
      out_file: path.join(__dirname, 'logs', 'pm2-out.log'),
      env: { NODE_ENV: 'development', PORT: 5000 },
      env_production: { NODE_ENV: 'production', PORT: Number(process.env.PORT || 5000) },
    },
    {
      ...common,
      name: 'secureasset-rental-automation',
      wait_ready: false,
      listen_timeout: 0,
      kill_timeout: 30_000,
      script: 'scripts/start-after-migrations.js',
      args: ['scripts/process-rental-automation.js'],
      autorestart: false,
      // Minute-level execution lets each tenancy's HH:mm due time be honoured
      // while the service itself remains idempotent through unique indexes.
      cron_restart: process.env.RENT_AUTOMATION_CRON || '* * * * *',
      max_memory_restart: '512M',
      error_file: path.join(__dirname, 'logs', 'rental-automation-error.log'),
      out_file: path.join(__dirname, 'logs', 'rental-automation-out.log'),
      env: { NODE_ENV: 'development' },
      env_production: { NODE_ENV: 'production' },
    },
    {
      ...common,
      name: 'secureasset-notification-delivery',
      wait_ready: false,
      listen_timeout: 0,
      kill_timeout: 30_000,
      script: 'scripts/start-after-migrations.js',
      args: ['scripts/process-notification-deliveries.js'],
      autorestart: false,
      cron_restart: process.env.NOTIFICATION_DELIVERY_CRON || '* * * * *',
      max_memory_restart: '512M',
      error_file: path.join(__dirname, 'logs', 'notification-delivery-error.log'),
      out_file: path.join(__dirname, 'logs', 'notification-delivery-out.log'),
      env: { NODE_ENV: 'development' },
      env_production: { NODE_ENV: 'production' },
    },
    {
      ...common,
      name: 'secureasset-vault-retention',
      wait_ready: false,
      listen_timeout: 0,
      kill_timeout: 30_000,
      script: 'scripts/start-after-migrations.js',
      args: ['scripts/purge-drive-trash.js'],
      autorestart: false,
      cron_restart: process.env.VAULT_PURGE_CRON || '17 2 * * *',
      max_memory_restart: '512M',
      error_file: path.join(__dirname, 'logs', 'vault-retention-error.log'),
      out_file: path.join(__dirname, 'logs', 'vault-retention-out.log'),
      env: { NODE_ENV: 'development' },
      env_production: { NODE_ENV: 'production' },
    },
    {
      ...common,
      name: 'secureasset-backup-automation',
      wait_ready: false,
      listen_timeout: 0,
      kill_timeout: 4 * 60 * 60 * 1000,
      script: 'scripts/start-after-migrations.js',
      args: ['scripts/process-backup-automation.js'],
      autorestart: false,
      // 17:00 in BACKUP_TIMEZONE (Asia/Kolkata by default). The worker uses
      // a per-day database key, so a PM2 restart cannot create duplicates.
      cron_restart: process.env.BACKUP_CRON || '0 17 * * *',
      max_memory_restart: '768M',
      error_file: path.join(__dirname, 'logs', 'backup-automation-error.log'),
      out_file: path.join(__dirname, 'logs', 'backup-automation-out.log'),
      env: { NODE_ENV: 'development', TZ: process.env.BACKUP_TIMEZONE || 'Asia/Kolkata' },
      env_production: { NODE_ENV: 'production', TZ: process.env.BACKUP_TIMEZONE || 'Asia/Kolkata' },
    },
  ],
};
