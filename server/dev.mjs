// Dev server starter - compile TS and run
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

// Load .env
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

// Fix DATABASE_URL to be relative to server dir
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:')) {
  const dbPath = process.env.DATABASE_URL.replace('file:', '');
  process.env.DATABASE_URL = 'file:' + join(__dirname, 'prisma', dbPath.replace('./', ''));
}

console.log(`Starting server from: ${__dirname}`);

const child = spawn('node', [join(__dirname, 'dist', 'index.js')], {
  stdio: 'inherit',
  cwd: __dirname,
  env: process.env,
});
child.on('exit', (code) => process.exit(code || 0));
