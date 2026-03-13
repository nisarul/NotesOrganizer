import { mkdir, readFile, writeFile, unlink, readdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { encryptText, decryptText, encryptBuffer, decryptBuffer } from './crypto.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');

export const PATHS = {
  data: DATA_DIR,
  notes: path.join(DATA_DIR, 'notes'),
  drafts: path.join(DATA_DIR, 'drafts'),
  images: path.join(DATA_DIR, 'images'),
  versions: path.join(DATA_DIR, 'versions'),
};

export async function ensureDataDirectories(): Promise<void> {
  for (const dir of Object.values(PATHS)) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}

// --- Note files ---

export async function writeNoteFile(noteId: string, content: string, userId: string): Promise<string> {
  const filePath = path.join(PATHS.notes, `${noteId}.md`);
  await writeFile(filePath, await encryptText(content, userId));
  return filePath;
}

export async function readNoteFile(noteId: string, userId: string): Promise<string> {
  const filePath = path.join(PATHS.notes, `${noteId}.md`);
  if (!existsSync(filePath)) return '';
  const encrypted = await readFile(filePath);
  return decryptText(encrypted, userId);
}

export async function deleteNoteFile(noteId: string): Promise<void> {
  const filePath = path.join(PATHS.notes, `${noteId}.md`);
  if (existsSync(filePath)) await unlink(filePath);
}

// --- Draft files ---

export async function writeDraftFile(noteId: string, content: string, userId: string): Promise<string> {
  const filePath = path.join(PATHS.drafts, `${noteId}.draft.md`);
  await writeFile(filePath, await encryptText(content, userId));
  return filePath;
}

export async function readDraftFile(noteId: string, userId: string): Promise<string | null> {
  const filePath = path.join(PATHS.drafts, `${noteId}.draft.md`);
  if (!existsSync(filePath)) return null;
  const encrypted = await readFile(filePath);
  return decryptText(encrypted, userId);
}

export async function deleteDraftFile(noteId: string): Promise<void> {
  const filePath = path.join(PATHS.drafts, `${noteId}.draft.md`);
  if (existsSync(filePath)) await unlink(filePath);
}

// --- Version files ---

export async function writeVersionFile(noteId: string, versionNumber: number, content: string, userId: string): Promise<string> {
  const versionDir = path.join(PATHS.versions, noteId);
  if (!existsSync(versionDir)) await mkdir(versionDir, { recursive: true });
  const filePath = path.join(versionDir, `v${versionNumber}.md`);
  await writeFile(filePath, await encryptText(content, userId));
  return filePath;
}

export async function readVersionFile(noteId: string, versionNumber: number, userId: string): Promise<string> {
  const filePath = path.join(PATHS.versions, noteId, `v${versionNumber}.md`);
  if (!existsSync(filePath)) return '';
  const encrypted = await readFile(filePath);
  return decryptText(encrypted, userId);
}

export async function deleteVersionFiles(noteId: string): Promise<void> {
  const versionDir = path.join(PATHS.versions, noteId);
  if (!existsSync(versionDir)) return;
  const files = await readdir(versionDir);
  for (const file of files) {
    await unlink(path.join(versionDir, file));
  }
  // Remove the directory itself (rmdir is fine since we cleared files)
  const { rmdir } = await import('fs/promises');
  await rmdir(versionDir);
}

// --- Image files ---

export async function ensureImageDir(noteId: string): Promise<string> {
  const imageDir = path.join(PATHS.images, noteId);
  if (!existsSync(imageDir)) await mkdir(imageDir, { recursive: true });
  return imageDir;
}

export async function saveImageFile(noteId: string, imageId: string, ext: string, buffer: Buffer, userId: string): Promise<string> {
  const imageDir = await ensureImageDir(noteId);
  const filename = `${imageId}${ext}`;
  const filePath = path.join(imageDir, filename);
  await writeFile(filePath, await encryptBuffer(buffer, userId));
  return filePath;
}

export async function readImageFile(noteId: string, filename: string, userId: string): Promise<Buffer> {
  const filePath = path.join(PATHS.images, noteId, filename);
  const encrypted = await readFile(filePath);
  return decryptBuffer(encrypted, userId);
}

export async function deleteImageFiles(noteId: string): Promise<void> {
  const imageDir = path.join(PATHS.images, noteId);
  if (!existsSync(imageDir)) return;
  const files = await readdir(imageDir);
  for (const file of files) {
    await unlink(path.join(imageDir, file));
  }
  const { rmdir } = await import('fs/promises');
  await rmdir(imageDir);
}

export async function copyNoteFiles(sourceNoteId: string, targetNoteId: string): Promise<void> {
  const sourceNotePath = path.join(PATHS.notes, `${sourceNoteId}.md`);
  const targetNotePath = path.join(PATHS.notes, `${targetNoteId}.md`);
  if (existsSync(sourceNotePath)) {
    await copyFile(sourceNotePath, targetNotePath);
  }
}
