import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { readNoteFile, readDraftFile } from '../services/storage.js';

const prisma = new PrismaClient();

export async function searchRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  server.get<{ Querystring: { q?: string; tags?: string } }>('/', async (request) => {
    const { q, tags } = request.query;
    if (!q && !tags) return { results: [] };

    const where: any = {
      isDeleted: false,
      notebook: { userId: request.user!.userId },
    };

    if (tags) {
      const tagNames = tags.split(',').map(t => t.trim());
      where.tags = { some: { tag: { name: { in: tagNames } } } };
    }

    // Fetch candidate notes (filter by title first if query exists)
    const notes = await prisma.note.findMany({
      where: q
        ? { ...where, title: { contains: q } }
        : where,
      take: 50,
      orderBy: { updatedAt: 'desc' },
      include: {
        notebook: { select: { id: true, name: true } },
        folder: { select: { id: true, name: true, parentId: true } },
        tags: { include: { tag: true } },
      },
    });

    // Also search in file content if query provided
    let contentMatches: typeof notes = [];
    if (q) {
      const allNotes = await prisma.note.findMany({
        where: { ...where, id: { notIn: notes.map((n: { id: string }) => n.id) } },
        take: 100,
        include: {
          notebook: { select: { id: true, name: true } },
          folder: { select: { id: true, name: true, parentId: true } },
          tags: { include: { tag: true } },
        },
      });

      for (const note of allNotes) {
        const content = note.isDirty
          ? (await readDraftFile(note.id, request.user!.userId)) ?? await readNoteFile(note.id, request.user!.userId)
          : await readNoteFile(note.id, request.user!.userId);

        if (content.toLowerCase().includes(q.toLowerCase())) {
          contentMatches.push(note);
          if (contentMatches.length >= 20) break;
        }
      }
    }

    const allResults = [...notes, ...contentMatches];

    // Build results with snippets
    const results = await Promise.all(
      allResults.map(async (note) => {
        const content = note.isDirty
          ? (await readDraftFile(note.id, request.user!.userId)) ?? await readNoteFile(note.id, request.user!.userId)
          : await readNoteFile(note.id, request.user!.userId);

        let snippet = '';
        if (q) {
          const idx = content.toLowerCase().indexOf(q.toLowerCase());
          if (idx >= 0) {
            const start = Math.max(0, idx - 50);
            const end = Math.min(content.length, idx + q.length + 50);
            snippet = (start > 0 ? '...' : '') + content.substring(start, end) + (end < content.length ? '...' : '');
          } else {
            snippet = content.substring(0, 100) + (content.length > 100 ? '...' : '');
          }
        } else {
          snippet = content.substring(0, 100) + (content.length > 100 ? '...' : '');
        }

        return {
          id: note.id,
          title: note.title,
          snippet,
          notebook: note.notebook,
          folder: note.folder,
          tags: note.tags.map((nt: { tag: { id: string; name: string; color: string } }) => nt.tag),
          updatedAt: note.updatedAt,
        };
      })
    );

    return { results };
  });
}
