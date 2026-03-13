import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();
const MAX_DEPTH = 3;

const createSchema = z.object({
  name: z.string().min(1).max(100),
  notebookId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export async function folderRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // List folders for a notebook
  server.get<{ Querystring: { notebookId: string } }>('/', async (request, reply) => {
    const { notebookId } = request.query;
    if (!notebookId) return reply.code(400).send({ error: 'notebookId query param required' });

    const folders = await prisma.folder.findMany({
      where: { notebookId, isDeleted: false },
      orderBy: { sortOrder: 'asc' },
      include: {
        notes: {
          where: { isDeleted: false },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true, title: true, isPinned: true, isFavorite: true,
            isDirty: true, sortOrder: true, createdAt: true, updatedAt: true,
          },
        },
      },
    });
    return { folders };
  });

  // Create folder
  server.post('/', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });

    const { name, notebookId, parentId } = parsed.data;

    // Verify notebook ownership
    const notebook = await prisma.notebook.findFirst({
      where: { id: notebookId, userId: request.user!.userId, isDeleted: false },
    });
    if (!notebook) return reply.code(404).send({ error: 'Notebook not found' });

    // Calculate depth
    let depth = 1;
    if (parentId) {
      const parent = await prisma.folder.findFirst({
        where: { id: parentId, notebookId, isDeleted: false },
      });
      if (!parent) return reply.code(404).send({ error: 'Parent folder not found' });
      depth = parent.depth + 1;
      if (depth > MAX_DEPTH) {
        return reply.code(400).send({ error: `Maximum nesting depth of ${MAX_DEPTH} reached` });
      }
    }

    const maxOrder = await prisma.folder.aggregate({
      where: { notebookId, parentId: parentId || null },
      _max: { sortOrder: true },
    });

    const folder = await prisma.folder.create({
      data: {
        name,
        notebookId,
        parentId: parentId || null,
        depth,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    return reply.code(201).send({ folder });
  });

  // Update folder
  server.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });

    const folder = await prisma.folder.findFirst({
      where: { id: request.params.id, isDeleted: false },
      include: { notebook: true },
    });
    if (!folder || folder.notebook.userId !== request.user!.userId) {
      return reply.code(404).send({ error: 'Folder not found' });
    }

    const updated = await prisma.folder.update({
      where: { id: request.params.id },
      data: parsed.data,
    });

    return { folder: updated };
  });

  // Soft-delete folder
  server.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const folder = await prisma.folder.findFirst({
      where: { id: request.params.id, isDeleted: false },
      include: { notebook: true },
    });
    if (!folder || folder.notebook.userId !== request.user!.userId) {
      return reply.code(404).send({ error: 'Folder not found' });
    }

    const now = new Date();

    // Soft-delete this folder and all descendants
    await softDeleteFolderTree(request.params.id, now);

    return { success: true };
  });
}

async function softDeleteFolderTree(folderId: string, deletedAt: Date): Promise<void> {
  // soft-delete the folder itself
  await prisma.folder.update({
    where: { id: folderId },
    data: { isDeleted: true, deletedAt },
  });

  // soft-delete notes in this folder
  await prisma.note.updateMany({
    where: { folderId, isDeleted: false },
    data: { isDeleted: true, deletedAt },
  });

  // recurse into child folders
  const children = await prisma.folder.findMany({
    where: { parentId: folderId, isDeleted: false },
  });
  for (const child of children) {
    await softDeleteFolderTree(child.id, deletedAt);
  }
}
