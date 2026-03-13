import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const prisma = new PrismaClient();

// --- Master key (from .env) — used only to protect per-user DEKs ---

let _masterKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (_masterKey) return _masterKey;
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32');
  }
  _masterKey = Buffer.from(hex, 'hex');
  return _masterKey;
}

function encryptWithKey(data: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

function decryptWithKey(data: Buffer, key: Buffer): Buffer {
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// --- Per-user DEK management ---

export function generateDEK(): Buffer {
  return randomBytes(32);
}

export function encryptDEK(dek: Buffer): Buffer {
  return encryptWithKey(dek, getMasterKey());
}

export function decryptDEK(encryptedDek: Buffer): Buffer {
  return decryptWithKey(encryptedDek, getMasterKey());
}

// In-memory cache: userId → decrypted DEK
const userKeyCache = new Map<string, Buffer>();

export async function loadUserKey(userId: string): Promise<Buffer> {
  const cached = userKeyCache.get(userId);
  if (cached) return cached;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { encryptionKey: true },
  });
  if (!user?.encryptionKey) {
    throw new Error(`No encryption key found for user ${userId}`);
  }

  const dek = decryptDEK(Buffer.from(user.encryptionKey));
  userKeyCache.set(userId, dek);
  return dek;
}

export function clearUserKeyCache(userId: string): void {
  userKeyCache.delete(userId);
}

// --- Encrypt/decrypt using per-user key ---

export async function encryptText(plaintext: string, userId: string): Promise<Buffer> {
  const key = await loadUserKey(userId);
  return encryptWithKey(Buffer.from(plaintext, 'utf-8'), key);
}

export async function decryptText(data: Buffer, userId: string): Promise<string> {
  const key = await loadUserKey(userId);
  return decryptWithKey(data, key).toString('utf-8');
}

export async function encryptBuffer(input: Buffer, userId: string): Promise<Buffer> {
  const key = await loadUserKey(userId);
  return encryptWithKey(input, key);
}

export async function decryptBuffer(data: Buffer, userId: string): Promise<Buffer> {
  const key = await loadUserKey(userId);
  return decryptWithKey(data, key);
}
