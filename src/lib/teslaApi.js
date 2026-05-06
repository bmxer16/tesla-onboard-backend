/**
 * Tesla API Client (ES Module)
 *
 * - OAuth token exchange + refresh
 * - Fleet API calls
 * - Vehicle command proxy calls
 *
 * Region: North America. Audience: fleet-api.prd.na.vn.cloud.tesla.com
 */

import { getTokens, saveTokens, needsRefresh } from './tokenStore.js';

const TESLA_AUTH_URL = 'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/authorize';
const TESLA_TOKEN_URL = 'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/token';
const TESLA_FLEET_API_NA = 'https://fleet-api.prd.na.vn.cloud.tesla.com';

const TESLA_PROXY_URL = process.env.TESLA_PROXY_URL || TESLA_FLEET_API_NA;

const CLIENT_ID = process.env.TESLA_CLIENT_ID;
const CLIENT_SECRET = process.env.TESLA_CLIENT_SECRET;
const REDIRECT_URI = process.env.TESLA_REDIRECT_URI;

const REQUIRED_SCOPES = [
  'openid',
  'offline_access',
  'vehicle_device_data',
  'vehicle_cmds',
  'vehicle_charging_cmds',
];

// === OAUTH ===

export function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: REQUIRED_SCOPES.join(' '),
    state: state,
    prompt: 'login',
  });
  return `${TESLA_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code: code,
    redirect_uri: REDIRECT_URI,
    audience: TESLA_FLEET_API_NA,
  });

  const res = await fetch(TESLA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${errText}`);
  }
  return res.json();
}

export async function refreshAccessToken(userId) {
  const tokens = getTokens(userId);
  if (!tokens || !tokens.refresh_token) {
    throw new Error('No refresh token available');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: tokens.refresh_token,
  });

  const res = await fetch(TESLA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${errText}`);
  }

  const newTokens = await res.json();
  saveTokens(userId, {
    ...newTokens,
    refresh_token: newTokens.refresh_token || tokens.refresh_token,
  });
  return newTokens;
}

export async function getValidAccessToken(userId) {
  if (needsRefresh(userId)) {
    await refreshAccessToken(userId);
  }
  const tokens = getTokens(userId);
  if (!tokens) throw new Error('User not authenticated');
  return tokens.access_token;
}

// === FLEET API ===

export async function listVehicles(userId) {
  const token = await getValidAccessToken(userId);
  const res = await fetch(`${TESLA_FLEET_API_NA}/api/1/vehicles`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`List vehicles failed: ${res.status}`);
  const data = await res.json();
  return data.response || [];
}

export async function wakeVehicle(userId, vehicleTag) {
  const token = await getValidAccessToken(userId);
  const res = await fetch(`${TESLA_FLEET_API_NA}/api/1/vehicles/${vehicleTag}/wake_up`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Wake vehicle failed: ${res.status}`);
  return res.json();
}

export async function getVehicleData(userId, vehicleTag) {
  const token = await getValidAccessToken(userId);

  const endpoints = [
    'charge_state',
    'climate_state',
    'drive_state',
    'gui_settings',
    'vehicle_state',
    'vehicle_config',
  ].join(';');

  const url = `${TESLA_FLEET_API_NA}/api/1/vehicles/${vehicleTag}/vehicle_data?endpoints=${endpoints}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 408) {
      await wakeVehicle(userId, vehicleTag);
      await new Promise((r) => setTimeout(r, 5000));
      return getVehicleData(userId, vehicleTag);
    }
    throw new Error(`Get vehicle data failed: ${res.status}`);
  }
  const data = await res.json();
  return data.response;
}

// === COMMANDS ===

export async function sendCommand(userId, vin, command, body = {}) {
  const token = await getValidAccessToken(userId);
  const url = `${TESLA_PROXY_URL}/api/1/vehicles/${vin}/command/${command}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Command ${command} failed: ${res.status} ${errText}`);
  }
  return res.json();
}
