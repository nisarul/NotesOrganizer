import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { readNoteFile, readDraftFile, readVersionFile } from '../services/storage.js';
import { restoreVersion } from '../services/versioning.js';
import { marked } from 'marked';

const prisma = new PrismaClient();

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeFilename(str: string): string {
  return str.replace(/[<>:"/\\|?*]/g, '_');
}

export async function exportRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  server.get<{ Params: { id: string }; Querystring: { format?: string } }>('/:id/export', async (request, reply) => {
    const note = await prisma.note.findFirst({
      where: { id: request.params.id, isDeleted: false, notebook: { userId: request.user!.userId } },
    });
    if (!note) return reply.code(404).send({ error: 'Note not found' });

    const content = note.isDirty
      ? (await readDraftFile(note.id, request.user!.userId)) ?? await readNoteFile(note.id, request.user!.userId)
      : await readNoteFile(note.id, request.user!.userId);

    const format = request.query.format || 'md';

    if (format === 'html') {
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(note.title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; line-height: 1.6; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 8px; overflow-x: auto; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; }
    pre code { background: none; padding: 0; }
    img { max-width: 100%; height: auto; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 16px; color: #666; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f4f4f4; }
  </style>
</head>
<body>
  <h1>${escapeHtml(note.title)}</h1>
  ${await marked(content)}
</body>
</html>`;
      reply.type('text/html');
      reply.header('Content-Disposition', `attachment; filename="${safeFilename(note.title)}.html"`);
      return html;
    }

    // Default: raw markdown
    reply.type('text/markdown');
    reply.header('Content-Disposition', `attachment; filename="${safeFilename(note.title)}.md"`);
    return content;
  });

  // Version history endpoints
  server.get<{ Params: { id: string } }>('/:id/versions', async (request, reply) => {
    const note = await prisma.note.findFirst({
      where: { id: request.params.id, isDeleted: false, notebook: { userId: request.user!.userId } },
    });
    if (!note) return reply.code(404).send({ error: 'Note not found' });

    const versions = await prisma.noteVersion.findMany({
      where: { noteId: note.id },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, message: true, createdAt: true },
    });

    return { versions };
  });

  server.get<{ Params: { id: string; versionId: string } }>('/:id/versions/:versionId', async (request, reply) => {
    const version = await prisma.noteVersion.findFirst({
      where: { id: request.params.versionId, noteId: request.params.id },
    });
    if (!version) return reply.code(404).send({ error: 'Version not found' });

    const content = await readVersionFile(request.params.id, version.versionNumber, request.user!.userId);

    return { version, content };
  });

  server.post<{ Params: { id: string; versionId: string } }>('/:id/versions/:versionId/restore', async (request, reply) => {
    const note = await prisma.note.findFirst({
      where: { id: request.params.id, isDeleted: false, notebook: { userId: request.user!.userId } },
    });
    if (!note) return reply.code(404).send({ error: 'Note not found' });

    const version = await prisma.noteVersion.findFirst({
      where: { id: request.params.versionId, noteId: note.id },
    });
    if (!version) return reply.code(404).send({ error: 'Version not found' });

    await restoreVersion(note.id, version.versionNumber, request.user!.userId);

    return { success: true };
  });
}
