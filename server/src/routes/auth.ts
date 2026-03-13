import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  type JwtPayload,
} from '../plugins/auth.js';

const prisma = new PrismaClient();

const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

export async function authRoutes(server: FastifyInstance) {
  // Register
  server.post('/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const { username, email, password } = parsed.data;

    // Check uniqueness
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (existing) {
      return reply.code(409).send({ error: 'Username or email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { username, email, passwordHash },
    });

    const payload: JwtPayload = { userId: user.id, username: user.username };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return reply.code(201).send({
      user: { id: user.id, username: user.username, email: user.email },
      accessToken,
      refreshToken,
    });
  });

  // Login
  server.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    const { username, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const payload: JwtPayload = { userId: user.id, username: user.username };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return { 
      user: { id: user.id, username: user.username, email: user.email },
      accessToken,
      refreshToken,
    };
  });

  // Refresh token
  server.post('/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Refresh token required' });
    }

    try {
      const payload = verifyRefreshToken(parsed.data.refreshToken);
      const newPayload: JwtPayload = { userId: payload.userId, username: payload.username };
      const accessToken = generateAccessToken(newPayload);
      const refreshToken = generateRefreshToken(newPayload);
      return { accessToken, refreshToken };
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired refresh token' });
    }
  });

  // Get current user (protected)
  server.get('/me', { preHandler: [server.authenticate] }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.userId },
      select: { id: true, username: true, email: true, createdAt: true },
    });
    return { user };
  });
}
