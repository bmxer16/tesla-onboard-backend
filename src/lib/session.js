/**
 * Session management — issues our own JWT after Tesla OAuth completes.
 * Tesla tokens never reach the browser; only our session JWT does.
 */

import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_TTL_DAYS = 30;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.warn('⚠️  JWT_SECRET missing or too short (min 32 chars).');
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

export function sign(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (SESSION_TTL_DAYS * 86400),
  }));
  const data = `${header}.${body}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (signature !== expected) return null;
  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const session = verify(token);
  if (!session || !session.userId) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  req.userId = session.userId;
  next();
}
