/**
 * Tesla Vehicle Routes
 * Mounted at /api/tesla in server.js (covers /api/tesla/vehicles/*)
 */

import express from 'express';
import * as teslaApi from '../lib/teslaApi.js';
import { requireAuth } from '../lib/session.js';

const router = express.Router();

const ALLOWED_COMMANDS = new Set([
  'door_lock',
  'door_unlock',
  'honk_horn',
  'flash_lights',
  'auto_conditioning_start',
  'auto_conditioning_stop',
  'actuate_trunk',
  'set_temps',
  'charge_start',
  'charge_stop',
  'set_charge_limit',
  'window_control',
  'remote_start_drive',
  'navigation_request',
]);

router.get('/vehicles', requireAuth, async (req, res) => {
  try {
    const vehicles = await teslaApi.listVehicles(req.userId);
    const sanitized = vehicles.map((v) => ({
      id: v.id_s || v.id,
      vin: v.vin,
      display_name: v.display_name,
      state: v.state,
      in_service: v.in_service,
      api_version: v.api_version,
    }));
    res.json({ vehicles: sanitized });
  } catch (err) {
    console.error('List vehicles error:', err);
    res.status(500).json({ error: 'list_failed', detail: err.message });
  }
});

router.get('/vehicles/:id/data', requireAuth, async (req, res) => {
  try {
    const data = await teslaApi.getVehicleData(req.userId, req.params.id);
    res.json({ data });
  } catch (err) {
    console.error('Get vehicle data error:', err);
    res.status(500).json({ error: 'data_fetch_failed', detail: err.message });
  }
});

router.post('/vehicles/:id/wake', requireAuth, async (req, res) => {
  try {
    const result = await teslaApi.wakeVehicle(req.userId, req.params.id);
    res.json({ result });
  } catch (err) {
    console.error('Wake error:', err);
    res.status(500).json({ error: 'wake_failed', detail: err.message });
  }
});

router.post('/vehicles/:vin/cmd/:command', requireAuth, async (req, res) => {
  const { vin, command } = req.params;
  if (!ALLOWED_COMMANDS.has(command)) {
    return res.status(400).json({ error: 'command_not_allowed', command });
  }
  try {
    const result = await teslaApi.sendCommand(req.userId, vin, command, req.body || {});
    res.json({ result });
  } catch (err) {
    console.error(`Command ${command} error:`, err);
    res.status(500).json({ error: 'command_failed', detail: err.message });
  }
});

export default router;
