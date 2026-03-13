import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import sharp from 'sharp';
import { saveImageFile, readImageFile, PATHS } from '../services/storage.js';

const prisma = new PrismaClient();

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

export async function imageRoutes(server: FastifyInstance) {
  server.addHook('preHandler', server.authenticate);

  // Upload image for a note
  server.post<{ Params: { id: string } }>('/:id/images', async (request, reply) => {
    const note = await prisma.note.findFirst({
      where: { id: request.params.id, isDeleted: false, notebook: { userId: request.user!.userId } },
    });
    if (!note) return reply.code(404).send({ error: 'Note not found' });

    const data = await request.file();
    if (!data) return reply.code(400).send({ error: 'No file uploaded' });

    if (!ALLOWED_TYPES.includes(data.mimetype)) {
      return reply.code(400).send({ error: 'Unsupported file type. Allowed: JPEG, PNG, GIF, WebP, SVG' });
    }

    const buffer = await data.toBuffer();
    const imageId = uuidv4();
    const ext = path.extname(data.filename) || '.png';

    // Resize if image is very large (max 1920px width)
    let processedBuffer = buffer;
    if (data.mimetype !== 'image/svg+xml') {
      const metadata = await sharp(buffer).metadata();
      if (metadata.width && metadata.width > 1920) {
        processedBuffer = await sharp(buffer)
          .resize({ width: 1920, withoutEnlargement: true })
          .toBuffer();
      }
    }

    const filePath = await saveImageFile(note.id, imageId, ext, processedBuffer, request.user!.userId);

    const image = await prisma.image.create({
      data: {
        id: imageId,
        noteId: note.id,
        filename: data.filename,
        path: filePath,
        size: processedBuffer.length,
      },
    });

    // Return URL that the editor can use
    const imageUrl = `/api/notes/${note.id}/images/${imageId}${ext}`;

    return reply.code(201).send({ image, url: imageUrl });
  });

  // Serve image
  server.get<{ Params: { id: string; imageFile: string } }>('/:id/images/:imageFile', async (request, reply) => {
    const { id, imageFile } = request.params;

    // Verify note ownership
    const note = await prisma.note.findFirst({
      where: { id, isDeleted: false, notebook: { userId: request.user!.userId } },
    });
    if (!note) return reply.code(404).send({ error: 'Note not found' });

    // Prevent path traversal
    if (imageFile.includes('..') || imageFile.includes('/') || imageFile.includes('\\')) {
      return reply.code(400).send({ error: 'Invalid filename' });
    }

    const filePath = path.join(PATHS.images, id, imageFile);

    try {
      const ext = path.extname(imageFile).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      };
      const decryptedBuffer = await readImageFile(id, imageFile, request.user!.userId);
      reply.type(mimeMap[ext] || 'application/octet-stream');
      return reply.send(decryptedBuffer);
    } catch {
      return reply.code(404).send({ error: 'Image not found' });
    }
  });

  // List images for a note
  server.get<{ Params: { id: string } }>('/:id/images', async (request, reply) => {
    const note = await prisma.note.findFirst({
      where: { id: request.params.id, isDeleted: false, notebook: { userId: request.user!.userId } },
    });
    if (!note) return reply.code(404).send({ error: 'Note not found' });

    const images = await prisma.image.findMany({
      where: { noteId: note.id },
      orderBy: { createdAt: 'desc' },
    });

    return { images };
  });
}
