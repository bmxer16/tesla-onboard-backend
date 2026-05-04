import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { mockVehicles, getVehicleById } from "../data/mockVehicles.js";

const router = Router();

// =====================================================================
// FLEET API: vehicles list and detail
// Real endpoints:
//   GET https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/vehicles
//   GET https://fleet-api.prd.na.vn.cloud.tesla.com/api/1/vehicles/{id}/vehicle_data
// =====================================================================

router.get("/", authenticate, (_req, res) => {
  res.json({
    response: mockVehicles.map((v) => ({
      id: v.id,
      vehicle_id: v.vehicle_id,
      vin: v.vin,
      display_name: v.display_name,
      model: v.model,
      state: v.state,
      color: v.color,
      api_version: v.api_version,
    })),
    count: mockVehicles.length,
  });
});

router.get("/:id/vehicle_data", authenticate, (req, res) => {
  const vehicle = getVehicleById(req.params.id);
  if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
  res.json({ response: vehicle });
});

router.post("/:id/wake_up", authenticate, (req, res) => {
  const vehicle = getVehicleById(req.params.id);
  if (!vehicle) return res.status(404).json({ error: "Vehicle not found" });
  vehicle.state = "online";
  res.json({ response: { ...vehicle, reason: "", result: true } });
});

export default router;
