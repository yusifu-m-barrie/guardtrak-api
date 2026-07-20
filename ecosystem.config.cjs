/**
 * PM2 process file for GuardTrak API (Mode B — production).
 *
 * Usage:
 *   npm run build
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 reload ecosystem.config.cjs --env production
 *
 * Keep instances=1 (fork) unless you add sticky sessions for Socket.IO.
 */
module.exports = {
  apps: [
    {
      name: 'guardtrak-api',
      script: 'dist/src/main.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      time: true,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      // Load variables from .env in cwd (PM2 5.2+); otherwise export before start
      // or use dotenv in the app (Nest ConfigModule already loads .env).
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
    },
  ],
};
