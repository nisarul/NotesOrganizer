import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const createSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().optional(),
  icon: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export async function notebookRoutes(server: FastifyInstance) {
  // All routes require auth
  server.addHook('preHandler', server.authenticate);

  // List notebooks
  server.get('/', async (request) => {
    const notebooks = await prisma.notebook.findMany({
      where: { userId: request.user!.userId, isDeleted: false },
      orderBy: { sortOrder: 'asc' },
      include: {
        folders: {
          where: { isDeleted: false, parentId: null },
          orderBy: { sortOrder: 'asc' },
          include: {
            notes: {
              where: { isDeleted: false },
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true, title: true, isPinned: true, isFavorite: true,
                isDirty: true, isPublic: true, publicSlug: true, sortOrder: true, lastOpenedAt: true,
                createdAt: true, updatedAt: true,
              },
            },
            children: {
              where: { isDeleted: false },
              orderBy: { sortOrder: 'asc' },
              include: {
                notes: {
                  where: { isDeleted: false },
                  orderBy: { sortOrder: 'asc' },
                  select: {
                    id: true, title: true, isPinned: true, isFavorite: true,
                    isDirty: true, isPublic: true, publicSlug: true, sortOrder: true, lastOpenedAt: true,
                    createdAt: true, updatedAt: true,
                  },
                },
                children: {
                  where: { isDeleted: false },
                  orderBy: { sortOrder: 'asc' },
                  include: {
                    notes: {
                      where: { isDeleted: false },
                      orderBy: { sortOrder: 'asc' },
                      select: {
                        id: true, title: true, isPinned: true, isFavorite: true,
                        isDirty: true, isPublic: true, publicSlug: true, sortOrder: true, lastOpenedAt: true,
                        createdAt: true, updatedAt: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        notes: {
          where: { isDeleted: false, folderId: null },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true, title: true, isPinned: true, isFavorite: true,
            isDirty: true, isPublic: true, publicSlug: true, sortOrder: true, lastOpenedAt: true,
            createdAt: true, updatedAt: true,
          },
        },
        _count: {
          select: { notes: { where: { isDeleted: false } } },
        },
      },
    });
    return { notebooks };
  });

  // Get single notebook
  server.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const notebook = await prisma.notebook.findFirst({
      where: { id: request.params.id, userId: request.user!.userId, isDeleted: false },
      include: {
        folders: { where: { isDeleted: false }, orderBy: { sortOrder: 'asc' } },
        notes: { where: { isDeleted: false }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!notebook) return reply.code(404).send({ error: 'Notebook not found' });
    return { notebook };
  });

  // Create notebook
  server.post('/', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });

    const maxOrder = await prisma.notebook.aggregate({
      where: { userId: request.user!.userId },
      _max: { sortOrder: true },
    });

    const notebook = await prisma.notebook.create({
      data: {
        name: parsed.data.name,
        color: parsed.data.color,
        icon: parsed.data.icon,
        userId: request.user!.userId,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    return reply.code(201).send({ notebook });
  });

  // Update notebook
  server.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });

    const existing = await prisma.notebook.findFirst({
      where: { id: request.params.id, userId: request.user!.userId, isDeleted: false },
    });
    if (!existing) return reply.code(404).send({ error: 'Notebook not found' });

    const notebook = await prisma.notebook.update({
      where: { id: request.params.id },
      data: parsed.data,
    });

    return { notebook };
  });

  // Soft-delete notebook
  server.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const existing = await prisma.notebook.findFirst({
      where: { id: request.params.id, userId: request.user!.userId, isDeleted: false },
    });
    if (!existing) return reply.code(404).send({ error: 'Notebook not found' });

    await prisma.notebook.update({
      where: { id: request.params.id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    // Also soft-delete all child folders and notes
    await prisma.folder.updateMany({
      where: { notebookId: request.params.id, isDeleted: false },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    await prisma.note.updateMany({
      where: { notebookId: request.params.id, isDeleted: false },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    return { success: true };
  });
}
