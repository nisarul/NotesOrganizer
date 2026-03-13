import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
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

  // Create a sample notebook
  const notebook = await prisma.notebook.upsert({
    where: { id: 'sample-notebook-id' },
    update: {},
    create: {
      id: 'sample-notebook-id',
      name: 'Getting Started',
      color: '#6366f1',
      icon: 'notebook',
      userId: admin.id,
      sortOrder: 0,
    },
  });

  console.log(`Created sample notebook: ${notebook.name}`);
  console.log('\nSeed complete!');
  console.log('Login with: admin / admin123');
  console.log('⚠️  Change the admin password after first login!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
