import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import {
  deleteNoteFile, deleteDraftFile, deleteVersionFiles, deleteImageFiles,
} from '../services/storage.js';

const prisma = new PrismaClient();

export async function trashRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // List all trashed items
  server.get('/', async (request) => {
    const [notebooks, folders, notes] = await Promise.all([
      prisma.notebook.findMany({
        where: { userId: request.user!.userId, isDeleted: true },
        orderBy: { deletedAt: 'desc' },
        select: { id: true, name: true, color: true, deletedAt: true },
      }),
      prisma.folder.findMany({
        where: { notebook: { userId: request.user!.userId }, isDeleted: true },
        orderBy: { deletedAt: 'desc' },
        select: { id: true, name: true, notebookId: true, deletedAt: true, notebook: { select: { name: true } } },
      }),
      prisma.note.findMany({
        where: { notebook: { userId: request.user!.userId }, isDeleted: true },
        orderBy: { deletedAt: 'desc' },
        select: {
          id: true, title: true, notebookId: true, folderId: true, deletedAt: true,
          notebook: { select: { name: true } },
          folder: { select: { name: true } },
        },
      }),
    ]);

    return {
      items: [
        ...notebooks.map((n: { id: string; name: string; color: string; deletedAt: Date | null }) => ({
          ...n, type: 'notebook' as const, path: n.name,
        })),
        ...folders.map((f: { id: string; name: string; notebookId: string; deletedAt: Date | null; notebook: { name: string } }) => ({
          ...f, type: 'folder' as const, path: f.notebook.name,
        })),
        ...notes.map((n: { id: string; title: string; notebookId: string; folderId: string | null; deletedAt: Date | null; notebook: { name: string }; folder: { name: string } | null }) => ({
          ...n, type: 'note' as const, name: n.title,
          path: n.folder ? `${n.notebook.name} > ${n.folder.name}` : n.notebook.name,
        })),
      ],
    };
  });

  // Restore item
  server.post<{ Params: { id: string }; Querystring: { type: string } }>('/:id/restore', async (request, reply) => {
    const { type } = request.query;
    if (!type || !['notebook', 'folder', 'note'].includes(type)) {
      return reply.code(400).send({ error: 'type query param required (notebook, folder, note)' });
    }

    if (type === 'notebook') {
      const item = await prisma.notebook.findFirst({
        where: { id: request.params.id, userId: request.user!.userId, isDeleted: true },
      });
      if (!item) return reply.code(404).send({ error: 'Item not found in trash' });

      await prisma.notebook.update({
        where: { id: item.id },
        data: { isDeleted: false, deletedAt: null },
      });
      // Also restore child folders and notes
      await prisma.folder.updateMany({
        where: { notebookId: item.id, isDeleted: true },
        data: { isDeleted: false, deletedAt: null },
      });
      await prisma.note.updateMany({
        where: { notebookId: item.id, isDeleted: true },
        data: { isDeleted: false, deletedAt: null },
      });
    } else if (type === 'folder') {
      const item = await prisma.folder.findFirst({
        where: { id: request.params.id, isDeleted: true, notebook: { userId: request.user!.userId } },
      });
      if (!item) return reply.code(404).send({ error: 'Item not found in trash' });

      await prisma.folder.update({
        where: { id: item.id },
        data: { isDeleted: false, deletedAt: null },
      });
      await prisma.note.updateMany({
        where: { folderId: item.id, isDeleted: true },
        data: { isDeleted: false, deletedAt: null },
      });
    } else {
      const item = await prisma.note.findFirst({
        where: { id: request.params.id, isDeleted: true, notebook: { userId: request.user!.userId } },
      });
      if (!item) return reply.code(404).send({ error: 'Item not found in trash' });

      await prisma.note.update({
        where: { id: item.id },
        data: { isDeleted: false, deletedAt: null },
      });
    }

    return { success: true };
  });

  // Permanent delete
  server.delete<{ Params: { id: string }; Querystring: { type: string } }>('/:id', async (request, reply) => {
    const { type } = request.query;
    if (!type || !['notebook', 'folder', 'note'].includes(type)) {
      return reply.code(400).send({ error: 'type query param required (notebook, folder, note)' });
    }

    if (type === 'notebook') {
      const item = await prisma.notebook.findFirst({
        where: { id: request.params.id, userId: request.user!.userId, isDeleted: true },
      });
      if (!item) return reply.code(404).send({ error: 'Item not found in trash' });

      // Delete all note files for notes in this notebook
      const notes = await prisma.note.findMany({
        where: { notebookId: item.id },
        select: { id: true },
      });
      for (const note of notes) {
        await deleteNoteFile(note.id);
        await deleteDraftFile(note.id);
        await deleteVersionFiles(note.id);
        await deleteImageFiles(note.id);
      }

      await prisma.notebook.delete({ where: { id: item.id } }); // cascades
    } else if (type === 'folder') {
      const item = await prisma.folder.findFirst({
        where: { id: request.params.id, isDeleted: true, notebook: { userId: request.user!.userId } },
      });
      if (!item) return reply.code(404).send({ error: 'Item not found in trash' });

      const notes = await prisma.note.findMany({
        where: { folderId: item.id },
        select: { id: true },
      });
      for (const note of notes) {
        await deleteNoteFile(note.id);
        await deleteDraftFile(note.id);
        await deleteVersionFiles(note.id);
        await deleteImageFiles(note.id);
      }

      await prisma.folder.delete({ where: { id: item.id } }); // cascades
    } else {
      const item = await prisma.note.findFirst({
        where: { id: request.params.id, isDeleted: true, notebook: { userId: request.user!.userId } },
      });
      if (!item) return reply.code(404).send({ error: 'Item not found in trash' });

      await deleteNoteFile(item.id);
      await deleteDraftFile(item.id);
      await deleteVersionFiles(item.id);
      await deleteImageFiles(item.id);
      await prisma.note.delete({ where: { id: item.id } });
    }

    return { success: true };
  });
}
