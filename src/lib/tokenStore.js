/**
 * Token Store — encrypted file-based storage for Tesla OAuth tokens.
 * AES-256-GCM authenticated encryption. File-based for simplicity.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const TOKENS_FILE = process.env.TOKENS_FILE_PATH || '/var/data/tesla-tokens.json';
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.warn('⚠️  TOKEN_ENCRYPTION_KEY missing or wrong length (expected 64 hex chars). Token storage disabled.');
}

function encrypt(plaintext) {
  if (!ENCRYPTION_KEY) throw new Error('Encryption key not configured');
  const iv = crypto.randomBytes(12);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(payload) {
  if (!ENCRYPTION_KEY) throw new Error('Encryption key not configured');
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function ensureFile() {
  const dir = path.dirname(TOKENS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(TOKENS_FILE)) fs.writeFileSync(TOKENS_FILE, '{}');
}

function readAll() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8') || '{}');
  } catch (e) {
    console.error('Token file corrupted:', e.message);
    return {};
  }
}

function writeAll(data) {
  ensureFile();
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(data, null, 2));
}

export function saveTokens(userId, tokens) {
  const all = readAll();
  const payload = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + (tokens.expires_in * 1000),
    id_token: tokens.id_token || null,
    scope: tokens.scope || null,
  };
  all[userId] = encrypt(JSON.stringify(payload));
  writeAll(all);
}

export function getTokens(userId) {
  const all = readAll();
  if (!all[userId]) return null;
  try {
    return JSON.parse(decrypt(all[userId]));
  } catch (e) {
    console.error(`Failed to decrypt tokens for ${userId}:`, e.message);
    return null;
  }
}

export function deleteTokens(userId) {
  const all = readAll();
  delete all[userId];
  writeAll(all);
}

export function listUsers() {
  return Object.keys(readAll());
}

export function needsRefresh(userId) {
  const tokens = getTokens(userId);
  if (!tokens) return false;
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() + fiveMinutes > tokens.expires_at;
}
