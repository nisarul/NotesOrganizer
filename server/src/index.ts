import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { authPlugin } from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';
import { notebookRoutes } from './routes/notebooks.js';
import { folderRoutes } from './routes/folders.js';
import { noteRoutes } from './routes/notes.js';
import { tagRoutes } from './routes/tags.js';
import { searchRoutes } from './routes/search.js';
import { imageRoutes } from './routes/images.js';
import { trashRoutes } from './routes/trash.js';
import { exportRoutes } from './routes/export.js';
import { ensureDataDirectories } from './services/storage.js';

const server = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
});

async function start() {
  // Ensure data directories exist
  await ensureDataDirectories();

  // Plugins
  await server.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  await server.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
  });

  await server.register(authPlugin);

  // Routes
  await server.register(authRoutes, { prefix: '/api/auth' });
  await server.register(notebookRoutes, { prefix: '/api/notebooks' });
  await server.register(folderRoutes, { prefix: '/api/folders' });
  await server.register(noteRoutes, { prefix: '/api/notes' });
  await server.register(tagRoutes, { prefix: '/api/tags' });
  await server.register(searchRoutes, { prefix: '/api/search' });
  await server.register(imageRoutes, { prefix: '/api/notes' });
  await server.register(trashRoutes, { prefix: '/api/trash' });
  await server.register(exportRoutes, { prefix: '/api/notes' });

  // Health check
  server.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Public note view (no auth required)
  server.get<{ Params: { slug: string } }>('/api/public/:slug', async (request, reply) => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const note = await prisma.note.findFirst({
        where: { publicSlug: request.params.slug, isPublic: true, isDeleted: false },
        include: {
          notebook: { select: { name: true } },
          folder: { select: { name: true } },
          tags: { include: { tag: true } },
        },
      });
      if (!note) return reply.code(404).send({ error: 'Note not found or not public' });

      // Get the note owner's userId for decryption
      const notebook = await prisma.notebook.findUnique({ where: { id: note.notebookId }, select: { userId: true } });
      const ownerId = notebook!.userId;

      const { readNoteFile, readDraftFile } = await import('./services/storage.js');
      const content = note.isDirty
        ? (await readDraftFile(note.id, ownerId)) ?? await readNoteFile(note.id, ownerId)
        : await readNoteFile(note.id, ownerId);

      return {
        note: {
          title: note.title,
          content,
          notebook: note.notebook.name,
          folder: note.folder?.name || null,
          tags: note.tags.map((t: { tag: { name: string; color: string } }) => ({ name: t.tag.name, color: t.tag.color })),
          updatedAt: note.updatedAt,
        },
      };
    } finally {
      await prisma.$disconnect();
    }
  });

  const port = parseInt(process.env.PORT || '3001', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await server.listen({ port, host });
    server.log.info(`Server running at http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
