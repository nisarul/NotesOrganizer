// Seed script - runs with plain Node.js (no tsx/esbuild needed)
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes, createCipheriv } from 'crypto';

const prisma = new PrismaClient();

function encryptDEK(dek) {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be set in .env (64 hex chars)');
  }
  const masterKey = Buffer.from(hex, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('admin123', 12);
  const dek = randomBytes(32);
  const encryptedDek = encryptDEK(dek);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { encryptionKey: encryptedDek },
    create: {
      username: 'admin',
      email: 'admin@localhost',
      passwordHash,
      encryptionKey: encryptedDek,
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
