import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  writeNoteFile, readNoteFile, readDraftFile, writeDraftFile,
  deleteNoteFile, deleteDraftFile, deleteVersionFiles, deleteImageFiles,
  copyNoteFiles,
} from '../services/storage.js';
import { commitNote } from '../services/versioning.js';
import { verifyAccessToken, type JwtPayload } from '../plugins/auth.js';

const prisma = new PrismaClient();

const createSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  notebookId: z.string().uuid(),
  folderId: z.string().uuid().nullable().optional(),
  content: z.string().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isPinned: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

export async function noteRoutes(server: FastifyInstance) {

  // GET /:id registered WITHOUT auth hook — handles both owner and public access
  server.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    // Soft auth — try to get user but don't fail
    let userId: string | undefined;
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = verifyAccessToken(authHeader.substring(7));
        userId = payload.userId;
      } catch { /* not authenticated */ }
    }

    // First try as owner
    let note = userId ? await prisma.note.findFirst({
      where: { id: request.params.id, isDeleted: false, notebook: { userId } },
      include: {
        tags: { include: { tag: true } },
        notebook: { select: { id: true, name: true } },
        folder: { select: { id: true, name: true, parentId: true } },
      },
    }) : null;

    let readonly = false;

    // If not found as owner, check if it's a public note
    if (!note) {
      note = await prisma.note.findFirst({
        where: { id: request.params.id, isDeleted: false, isPublic: true },
        include: {
          tags: { include: { tag: true } },
          notebook: { select: { id: true, name: true } },
          folder: { select: { id: true, name: true, parentId: true } },
        },
      });
      if (!note) return reply.code(404).send({ error: 'Note not found' });
      readonly = true;
    }

    if (!readonly) {
      await prisma.note.update({ where: { id: note.id }, data: { lastOpenedAt: new Date() } });
    }

    // For public notes, get the owner's userId from the notebook
    const ownerId = readonly
      ? (await prisma.notebook.findUnique({ where: { id: note.notebookId }, select: { userId: true } }))!.userId
      : userId!;

    let content: string;
    if (!readonly && note.isDirty) {
      const draft = await readDraftFile(note.id, ownerId);
      content = draft ?? await readNoteFile(note.id, ownerId);
    } else {
      content = await readNoteFile(note.id, ownerId);
    }

    const breadcrumb = await buildBreadcrumb(note.notebookId, note.folderId);
    return { note: { ...note, content }, breadcrumb, readonly };
  });

  // All remaining routes require authentication
  server.addHook('preHandler', server.authenticate);

  // List notes (with optional filters)
  server.get<{ Querystring: { folderId?: string; notebookId?: string; filter?: string } }>('/', async (request) => {
    const { folderId, notebookId, filter } = request.query;
    const where: any = { isDeleted: false };

    // Ensure we only return notes belonging to user's notebooks
    where.notebook = { userId: request.user!.userId };

    if (folderId) where.folderId = folderId;
    if (notebookId) {
      where.notebookId = notebookId;
      if (!folderId) where.folderId = null; // root-level notes only if no folder specified
    }

    if (filter === 'favorites') where.isFavorite = true;
    if (filter === 'pinned') where.isPinned = true;
    if (filter === 'recent') {
      const notes = await prisma.note.findMany({
        where,
        orderBy: { lastOpenedAt: 'desc' },
        take: 20,
        select: {
          id: true, title: true, isPinned: true, isFavorite: true, isDirty: true,
          sortOrder: true, lastOpenedAt: true, notebookId: true, folderId: true,
          createdAt: true, updatedAt: true,
          notebook: { select: { name: true } },
          folder: { select: { name: true } },
          tags: { include: { tag: true } },
        },
      });
      return { notes };
    }

    if (filter?.startsWith('tag:')) {
      const tagName = filter.substring(4);
      where.tags = { some: { tag: { name: tagName } } };
    }

    const notes = await prisma.note.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true, title: true, isPinned: true, isFavorite: true, isDirty: true,
        sortOrder: true, lastOpenedAt: true, notebookId: true, folderId: true,
        createdAt: true, updatedAt: true,
        notebook: { select: { name: true } },
        folder: { select: { name: true } },
        tags: { include: { tag: true } },
      },
    });
    return { notes };
  });

  // Create note
  server.post('/', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });

    const { title, notebookId, folderId, content } = parsed.data;

    // Verify notebook ownership
    const notebook = await prisma.notebook.findFirst({
      where: { id: notebookId, userId: request.user!.userId, isDeleted: false },
    });
    if (!notebook) return reply.code(404).send({ error: 'Notebook not found' });

    // If folderId, verify it belongs to this notebook
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, notebookId, isDeleted: false },
      });
      if (!folder) return reply.code(404).send({ error: 'Folder not found' });
    }

    const maxOrder = await prisma.note.aggregate({
      where: { notebookId, folderId: folderId || null },
      _max: { sortOrder: true },
    });

    const note = await prisma.note.create({
      data: {
        title: title || 'Untitled',
        notebookId,
        folderId: folderId || null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    // Write initial content
    const initialContent = content || '';
    await writeNoteFile(note.id, initialContent, request.user!.userId);
    await prisma.note.update({
      where: { id: note.id },
      data: { contentPath: `data/notes/${note.id}.md` },
    });

    return reply.code(201).send({ note });
  });

  // Update note metadata
  server.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });

    const note = await prisma.note.findFirst({
      where: { id: request.params.id, isDeleted: false, notebook: { userId: request.user!.userId } },
    });
    if (!note) return reply.code(404).send({ error: 'Note not found' });

    const updated = await prisma.note.update({
      where: { id: request.params.id },
      data: parsed.data,
    });

    return { note: updated };
  });

  // Save draft (auto-save on type)
  server.put<{ Params: { id: string } }>('/:id/draft', async (request, reply) => {
    const body = request.body as { content?: string };
    if (typeof body?.content !== 'string') {
      return reply.code(400).send({ error: 'content field required' });
    }

    const note = await prisma.note.findFirst({
      where: { id: request.params.id, isDeleted: false, notebook: { userId: request.user!.userId } },
    });
    if (!note) return reply.code(404).send({ error: 'Note not found' });

    await writeDraftFile(note.id, body.content, request.user!.userId);
    await prisma.note.update({
      where: { id: note.id },
      data: { isDirty: true, draftPath: `data/drafts/${note.id}.draft.md` },
    });

    return { success: true, isDirty: true };
  });

  // Commit note (explicit save + version)
  server.post<{ Params: { id: string } }>('/:id/commit', async (request, reply) => {
    const body = request.body as { message?: string };

    const note = await prisma.note.findFirst({
      where: { id: request.params.id, isDeleted: false, notebook: { userId: request.user!.userId } },
    });
    if (!note) return reply.code(404).send({ error: 'Note not found' });

    await commitNote(note.id, request.user!.userId, body?.message);

    return { success: true, isDirty: false };
  });

  // Move note
  server.patch<{ Params: { id: string } }>('/:id/move', async (request, reply) => {
    const body = request.body as { notebookId?: string; folderId?: string | null };

    const note = await prisma.note.findFirst({
      where: { id: request.params.id, isDeleted: false, notebook: { userId: request.user!.userId } },
    });
    if (!note) return reply.code(404).send({ error: 'Note not found' });

    const targetNotebookId = body?.notebookId || note.notebookId;
    const targetFolderId = body?.folderId !== undefined ? body.folderId : note.folderId;

    // Verify target notebook
    const targetNotebook = await prisma.notebook.findFirst({
      where: { id: targetNotebookId, userId: request.user!.userId, isDeleted: false },
    });
    if (!targetNotebook) return reply.code(404).send({ error: 'Target notebook not found' });

    // Verify target folder if specified
    if (targetFolderId) {
      const targetFolder = await prisma.folder.findFirst({
        where: { id: targetFolderId, notebookId: targetNotebookId, isDeleted: false },
      });
      if (!targetFolder) return reply.code(404).send({ error: 'Target folder not found' });
    }

    const updated = await prisma.note.update({
      where: { id: note.id },
      data: { notebookId: targetNotebookId, folderId: targetFolderId || null },
    });

    return { note: updated };
  });

  // Copy note
  server.post<{ Params: { id: string } }>('/:id/copy', async (request, reply) => {
    const body = request.body as { notebookId?: string; folderId?: string | null };

    const note = await prisma.note.findFirst({
      where: { id: request.params.id, isDeleted: false, notebook: { userId: request.user!.userId } },
    });
    if (!note) return reply.code(404).send({ error: 'Note not found' });

    const targetNotebookId = body?.notebookId || note.notebookId;
    const targetFolderId = body?.folderId !== undefined ? body.folderId : note.folderId;

    const maxOrder = await prisma.note.aggregate({
      where: { notebookId: targetNotebookId, folderId: targetFolderId || null },
      _max: { sortOrder: true },
    });

    const copy = await prisma.note.create({
      data: {
        title: `${note.title} (Copy)`,
        notebookId: targetNotebookId,
        folderId: targetFolderId || null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    // Copy the file on disk
    await copyNoteFiles(note.id, copy.id);
    await prisma.note.update({
      where: { id: copy.id },
      data: { contentPath: `data/notes/${copy.id}.md` },
    });

    return reply.code(201).send({ note: copy });
  });

  // Soft-delete note
  server.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const note = await prisma.note.findFirst({
      where: { id: request.params.id, isDeleted: false, notebook: { userId: request.user!.userId } },
    });
    if (!note) return reply.code(404).send({ error: 'Note not found' });

    await prisma.note.update({
      where: { id: note.id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    return { success: true };
  });

  // Pin/Favorite toggles
  server.patch<{ Params: { id: string } }>('/:id/pin', async (request, reply) => {
    const note = await prisma.note.findFirst({
      where: { id: request.params.id, isDeleted: false, notebook: { userId: request.user!.userId } },
    });
    if (!note) return reply.code(404).send({ error: 'Note not found' });

    const updated = await prisma.note.update({
      where: { id: note.id },
      data: { isPinned: !note.isPinned },
    });
    return { note: updated };
  });

  server.patch<{ Params: { id: string } }>('/:id/favorite', async (request, reply) => {
    const note = await prisma.note.findFirst({
      where: { id: request.params.id, isDeleted: false, notebook: { userId: request.user!.userId } },
    });
    if (!note) return reply.code(404).send({ error: 'Note not found' });

    const updated = await prisma.note.update({
      where: { id: note.id },
      data: { isFavorite: !note.isFavorite },
    });
    return { note: updated };
  });

  // Reorder
  server.patch('/reorder', async (request, reply) => {
    const body = request.body as { type: string; items: { id: string; sortOrder: number }[] };
    if (!body?.type || !Array.isArray(body?.items)) {
      return reply.code(400).send({ error: 'type and items[] required' });
    }

    if (!['notebook', 'folder', 'note'].includes(body.type)) {
      return reply.code(400).send({ error: 'type must be notebook, folder, or note' });
    }

    const userId = request.user!.userId;

    // Verify ownership of all items before updating
    if (body.type === 'notebook') {
      const owned = await prisma.notebook.findMany({
        where: { id: { in: body.items.map(i => i.id) }, userId },
        select: { id: true },
      });
      if (owned.length !== body.items.length) {
        return reply.code(403).send({ error: 'Cannot reorder items you do not own' });
      }
      for (const item of body.items) {
        await prisma.notebook.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } });
      }
    } else if (body.type === 'folder') {
      const owned = await prisma.folder.findMany({
        where: { id: { in: body.items.map(i => i.id) }, notebook: { userId } },
        select: { id: true },
      });
      if (owned.length !== body.items.length) {
        return reply.code(403).send({ error: 'Cannot reorder items you do not own' });
      }
      for (const item of body.items) {
        await prisma.folder.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } });
      }
    } else {
      const owned = await prisma.note.findMany({
        where: { id: { in: body.items.map(i => i.id) }, notebook: { userId } },
        select: { id: true },
      });
      if (owned.length !== body.items.length) {
        return reply.code(403).send({ error: 'Cannot reorder items you do not own' });
      }
      for (const item of body.items) {
        await prisma.note.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } });
      }
    }

    return { success: true };
  });

  // Toggle public sharing
  server.patch<{ Params: { id: string } }>('/:id/public', async (request, reply) => {
    const note = await prisma.note.findFirst({
      where: { id: request.params.id, isDeleted: false, notebook: { userId: request.user!.userId } },
    });
    if (!note) return reply.code(404).send({ error: 'Note not found' });

    const isPublic = !note.isPublic;
    let publicSlug = note.publicSlug;

    if (isPublic && !publicSlug) {
      // Generate a short slug
      const { v4 } = await import('uuid');
      publicSlug = v4().substring(0, 8);
    }

    const updated = await prisma.note.update({
      where: { id: note.id },
      data: { isPublic, publicSlug: isPublic ? publicSlug : note.publicSlug },
    });

    return { note: { isPublic: updated.isPublic, publicSlug: updated.publicSlug } };
  });
}

async function buildBreadcrumb(notebookId: string, folderId: string | null) {
  const parts: { id: string; name: string; type: string }[] = [];

  const notebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    select: { id: true, name: true },
  });
  if (notebook) parts.push({ id: notebook.id, name: notebook.name, type: 'notebook' });

  if (folderId) {
    const folderChain: { id: string; name: string; type: string }[] = [];
    let currentFolderId: string | null = folderId;
    while (currentFolderId) {
      const currentFolder: { id: string; name: string; parentId: string | null } | null = await prisma.folder.findUnique({
        where: { id: currentFolderId },
        select: { id: true, name: true, parentId: true },
      });
      if (!currentFolder) break;
      folderChain.unshift({ id: currentFolder.id, name: currentFolder.name, type: 'folder' });
      currentFolderId = currentFolder.parentId;
    }
    parts.push(...folderChain);
  }

  return parts;
}
