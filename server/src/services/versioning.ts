import { PrismaClient } from '@prisma/client';
import { readNoteFile, readDraftFile, writeNoteFile, writeVersionFile, deleteDraftFile } from './storage.js';

const prisma = new PrismaClient();

export async function createVersionSnapshot(
  noteId: string,
  userId: string,
  message?: string
): Promise<{ versionNumber: number; contentPath: string }> {
  // Get current content: prefer draft if dirty, otherwise committed note
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) throw new Error(`Note ${noteId} not found`);

  let content: string;
  if (note.isDirty) {
    const draft = await readDraftFile(noteId, userId);
    content = draft || await readNoteFile(noteId, userId);
  } else {
    content = await readNoteFile(noteId, userId);
  }

  // Determine next version number
  const lastVersion = await prisma.noteVersion.findFirst({
    where: { noteId },
    orderBy: { versionNumber: 'desc' },
  });
  const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

  // Write version file
  const contentPath = await writeVersionFile(noteId, versionNumber, content, userId);

  // Create version record
  await prisma.noteVersion.create({
    data: {
      noteId,
      contentPath,
      versionNumber,
      message: message || null,
    },
  });

  return { versionNumber, contentPath };
}

export async function commitNote(noteId: string, userId: string, message?: string): Promise<void> {
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) throw new Error(`Note ${noteId} not found`);

  // Read draft content
  const draftContent = await readDraftFile(noteId, userId);
  const content = draftContent ?? await readNoteFile(noteId, userId);

  // Write to committed note file
  await writeNoteFile(noteId, content, userId);

  // Create version snapshot
  await createVersionSnapshot(noteId, userId, message);

  // Clean up draft
  await deleteDraftFile(noteId);

  // Update note state
  await prisma.note.update({
    where: { id: noteId },
    data: { isDirty: false, updatedAt: new Date() },
  });
}

export async function restoreVersion(noteId: string, versionNumber: number, userId: string): Promise<void> {
  const versionRecord = await prisma.noteVersion.findFirst({
    where: { noteId, versionNumber },
  });
  if (!versionRecord) throw new Error(`Version ${versionNumber} not found for note ${noteId}`);

  const { readVersionFile } = await import('./storage.js');
  const content = await readVersionFile(noteId, versionNumber, userId);

  // Write as current committed content
  await writeNoteFile(noteId, content, userId);

  // Clean up any draft
  await deleteDraftFile(noteId);

  // Mark not dirty
  await prisma.note.update({
    where: { id: noteId },
    data: { isDirty: false, updatedAt: new Date() },
  });
}
