module.exports = {
  apps: [
    {
      name: 'notesorganizer',
      script: 'server/dist/index.js',
      cwd: '/var/www/notesorganizer',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DATABASE_URL: 'file:../prisma/dev.db',
        JWT_SECRET: 'CHANGE_THIS_TO_A_RANDOM_64_CHAR_SECRET',
        JWT_REFRESH_SECRET: 'CHANGE_THIS_TO_ANOTHER_RANDOM_64_CHAR_SECRET',
        CORS_ORIGIN: 'https://notes.yourdomain.com',
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '256M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
