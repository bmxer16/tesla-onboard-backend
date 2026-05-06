/**
 * Tesla Auth Routes
 * Mounted at /api/tesla/auth in server.js
 */

import express from 'express';
import crypto from 'crypto';
import * as teslaApi from '../lib/teslaApi.js';
import * as tokenStore from '../lib/tokenStore.js';
import { sign, requireAuth } from '../lib/session.js';

const router = express.Router();

// In-memory CSRF state store (10 min TTL)
const stateStore = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of stateStore.entries()) {
    if (now - v.created > STATE_TTL_MS) stateStore.delete(k);
  }
}, 5 * 60 * 1000);

router.get('/start', (req, res) => {
  const state = crypto.randomBytes(32).toString('base64url');
  stateStore.set(state, { created: Date.now() });
  const authUrl = teslaApi.buildAuthorizeUrl(state);
  res.json({ authUrl, state });
});

router.post('/callback', async (req, res) => {
  const { code, state } = req.body || {};
  if (!code || !state) return res.status(400).json({ error: 'missing_code_or_state' });
  if (!stateStore.has(state)) return res.status(400).json({ error: 'invalid_state' });
  stateStore.delete(state);

  try {
    const tokens = await teslaApi.exchangeCodeForTokens(code);
    const idTokenPayload = parseIdToken(tokens.id_token);
    const userId = idTokenPayload.sub || idTokenPayload.email || `user_${Date.now()}`;

    tokenStore.saveTokens(userId, tokens);
    const sessionJwt = sign({ userId, email: idTokenPayload.email });

    res.json({
      sessionJwt,
      user: { id: userId, email: idTokenPayload.email || null },
    });
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).json({ error: 'token_exchange_failed', detail: err.message });
  }
});

router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    tokenStore.deleteTokens(req.userId);
    res.json({ disconnected: true });
  } catch (err) {
    res.status(500).json({ error: 'disconnect_failed', detail: err.message });
  }
});

router.get('/status', requireAuth, (req, res) => {
  const tokens = tokenStore.getTokens(req.userId);
  res.json({
    authenticated: true,
    teslaConnected: !!tokens,
    expiresAt: tokens ? tokens.expires_at : null,
  });
});

function parseIdToken(idToken) {
  if (!idToken) return {};
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return {};
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  } catch {
    return {};
  }
}

export default router;
