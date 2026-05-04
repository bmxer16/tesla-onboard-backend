import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { getVehicleById } from "../data/mockVehicles.js";

const router = Router();

// =====================================================================
// FLEET API: vehicle commands
// Real base path: /api/1/vehicles/{id}/command/{command_name}
// All commands return { response: { reason: "", result: true|false } }
//
// IMPORTANT: real commands must be signed with a Tesla Vehicle Command
// Protocol key. See: https://github.com/teslamotors/vehicle-command
// For now we just mutate the in-memory mock and return success.
// =====================================================================

function ok(res, extra = {}) {
  res.json({ response: { reason: "", result: true, ...extra } });
}

// Climate
router.post("/:id/command/auto_conditioning_start", authenticate, (req, res) => {
  const v = getVehicleById(req.params.id);
  if (!v) return res.status(404).json({ error: "Vehicle not found" });
  v.climate_state.is_climate_on = true;
  v.climate_state.is_auto_conditioning_on = true;
  ok(res);
});

router.post("/:id/command/auto_conditioning_stop", authenticate, (req, res) => {
  const v = getVehicleById(req.params.id);
  if (!v) return res.status(404).json({ error: "Vehicle not found" });
  v.climate_state.is_climate_on = false;
  v.climate_state.is_auto_conditioning_on = false;
  ok(res);
});

router.post("/:id/command/set_temps", authenticate, (req, res) => {
  const v = getVehicleById(req.params.id);
  if (!v) return res.status(404).json({ error: "Vehicle not found" });
  const { driver_temp, passenger_temp } = req.body || {};
  if (typeof driver_temp === "number") v.climate_state.driver_temp_setting = driver_temp;
  if (typeof passenger_temp === "number") v.climate_state.passenger_temp_setting = passenger_temp;
  ok(res);
});

// Locks
router.post("/:id/command/door_lock", authenticate, (req, res) => {
  const v = getVehicleById(req.params.id);
  if (!v) return res.status(404).json({ error: "Vehicle not found" });
  v.vehicle_state.locked = true;
  ok(res);
});

router.post("/:id/command/door_unlock", authenticate, (req, res) => {
  const v = getVehicleById(req.params.id);
  if (!v) return res.status(404).json({ error: "Vehicle not found" });
  v.vehicle_state.locked = false;
  ok(res);
});

// Charging
router.post("/:id/command/charge_start", authenticate, (req, res) => {
  const v = getVehicleById(req.params.id);
  if (!v) return res.status(404).json({ error: "Vehicle not found" });
  v.charge_state.charging_state = "Charging";
  ok(res);
});

router.post("/:id/command/charge_stop", authenticate, (req, res) => {
  const v = getVehicleById(req.params.id);
  if (!v) return res.status(404).json({ error: "Vehicle not found" });
  v.charge_state.charging_state = "Stopped";
  ok(res);
});

router.post("/:id/command/set_charge_limit", authenticate, (req, res) => {
  const v = getVehicleById(req.params.id);
  if (!v) return res.status(404).json({ error: "Vehicle not found" });
  const { percent } = req.body || {};
  if (typeof percent === "number") v.charge_state.charge_limit_soc = percent;
  ok(res);
});

// Frunk / trunk
router.post("/:id/command/actuate_trunk", authenticate, (req, res) => {
  const v = getVehicleById(req.params.id);
  if (!v) return res.status(404).json({ error: "Vehicle not found" });
  // body: { which_trunk: "front" | "rear" }
  ok(res);
});

// Honk / flash / sentry
router.post("/:id/command/honk_horn", authenticate, (_req, res) => ok(res));
router.post("/:id/command/flash_lights", authenticate, (_req, res) => ok(res));
router.post("/:id/command/set_sentry_mode", authenticate, (req, res) => {
  const v = getVehicleById(req.params.id);
  if (!v) return res.status(404).json({ error: "Vehicle not found" });
  const { on } = req.body || {};
  v.vehicle_state.sentry_mode = !!on;
  ok(res);
});

// Navigation
router.post("/:id/command/navigation_request", authenticate, (req, res) => {
  // body: { destination: "1 Tesla Rd, Austin TX" }
  ok(res);
});

export default router;
