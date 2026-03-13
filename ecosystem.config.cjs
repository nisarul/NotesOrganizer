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
        JWT_SECRET: '010e82485df5b80571b6265faad5bc915f41b4d0a511b9def848e0936165f772',
        JWT_REFRESH_SECRET: '8bec411a84e579576b80a360b7b2c402a07f0e1eba1f9b46956aea89cb26a341',
        CORS_ORIGIN: 'https://notes.snh.one',
        ENCRYPTION_KEY: '74c900703b57c10fccec2184ebefed7f8f2dded656f09ed2a1f5b3a89cc50997',
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '256M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
