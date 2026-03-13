// Seed script - runs with plain Node.js (no tsx/esbuild needed)
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('admin123', 12);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@localhost',
      passwordHash,
    },
  });

  console.log(`Created admin user: ${admin.username} (${admin.id})`);

  // Check if a notebook already exists for this user
  const existingNotebook = await prisma.notebook.findFirst({
    where: { userId: admin.id },
  });

  if (!existingNotebook) {
    const notebook = await prisma.notebook.create({
      data: {
        name: 'Getting Started',
        icon: 'notebook',
        userId: admin.id,
        sortOrder: 0,
      },
    });
    console.log(`Created sample notebook: ${notebook.name}`);
  } else {
    console.log(`Sample notebook already exists: ${existingNotebook.name}`);
  }
  console.log('\nSeed complete!');
  console.log('Login with: admin / admin123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
