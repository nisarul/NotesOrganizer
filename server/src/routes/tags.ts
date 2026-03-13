import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().optional(),
});

export async function tagRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // List all tags
  server.get('/', async (request) => {
    const tags = await prisma.tag.findMany({
      where: { userId: request.user!.userId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { notes: true } } },
    });
    return { tags };
  });

  // Create tag
  server.post('/', async (request, reply) => {
    const parsed = createTagSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });

    const existing = await prisma.tag.findFirst({
      where: { name: parsed.data.name, userId: request.user!.userId },
    });
    if (existing) return reply.code(409).send({ error: 'Tag already exists', tag: existing });

    const tag = await prisma.tag.create({
      data: { name: parsed.data.name, color: parsed.data.color, userId: request.user!.userId },
    });

    return reply.code(201).send({ tag });
  });

  // Delete tag
  server.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const tag = await prisma.tag.findFirst({
      where: { id: request.params.id, userId: request.user!.userId },
    });
    if (!tag) return reply.code(404).send({ error: 'Tag not found' });

    await prisma.tag.delete({ where: { id: tag.id } });
    return { success: true };
  });

  // Assign tag to note
  server.post<{ Params: { noteId: string } }>('/notes/:noteId/tags', async (request, reply) => {
    const body = request.body as { tagId: string };
    if (!body?.tagId) return reply.code(400).send({ error: 'tagId required' });

    // Verify note ownership
    const note = await prisma.note.findFirst({
      where: { id: request.params.noteId, isDeleted: false, notebook: { userId: request.user!.userId } },
    });
    if (!note) return reply.code(404).send({ error: 'Note not found' });

    // Verify tag ownership
    const tag = await prisma.tag.findFirst({
      where: { id: body.tagId, userId: request.user!.userId },
    });
    if (!tag) return reply.code(404).send({ error: 'Tag not found' });

    await prisma.noteTag.upsert({
      where: { noteId_tagId: { noteId: note.id, tagId: tag.id } },
      create: { noteId: note.id, tagId: tag.id },
      update: {},
    });

    return { success: true };
  });

  // Remove tag from note
  server.delete<{ Params: { noteId: string; tagId: string } }>('/notes/:noteId/tags/:tagId', async (request, reply) => {
    const note = await prisma.note.findFirst({
      where: { id: request.params.noteId, isDeleted: false, notebook: { userId: request.user!.userId } },
    });
    if (!note) return reply.code(404).send({ error: 'Note not found' });

    await prisma.noteTag.deleteMany({
      where: { noteId: note.id, tagId: request.params.tagId },
    });

    return { success: true };
  });
}
