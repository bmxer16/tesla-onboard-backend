import express from "express";
import crypto from "crypto";
import * as teslaApi from "../lib/teslaApi.js";
import { requireAuth } from "../lib/session.js";
import { getMissions, saveMissions } from "../lib/missionStore.js";

const router = express.Router();

const PACK_KWH = 75;
const RATE_PER_KWH = 0.16;
const GAS_MPG = 30;
const GAS_PRICE = 4.8;
const IRS_RATE = 0.725;
const CATEGORIES = ["business", "rental", "family"];

async function snapshot(userId) {
  const vehicles = await teslaApi.listVehicles(userId);
  const v = vehicles[0];
  if (!v) throw new Error("no_vehicle");
  const id = v.id_s || v.id;
  const data = await teslaApi.getVehicleData(userId, id);
  return {
    vehicleName: v.display_name,
    vin: v.vin,
    odometer: data?.vehicle_state?.odometer ?? null,
    battery: data?.charge_state?.battery_level ?? null,
    lat: data?.drive_state?.latitude ?? null,
    lon: data?.drive_state?.longitude ?? null,
    at: new Date().toISOString(),
  };
}

router.get("/", requireAuth, (req, res) => {
  const missions = getMissions(req.userId);
  res.json({
    missions: [...missions].reverse(),
    active: missions.find((m) => m.status === "active") || null,
    irsRate: IRS_RATE,
  });
});

router.post("/start", requireAuth, async (req, res) => {
  try {
    const missions = getMissions(req.userId);
    const existing = missions.find((m) => m.status === "active");
    if (existing) return res.json({ mission: existing, alreadyActive: true });

    const category = CATEGORIES.includes(req.body?.category) ? req.body.category : "family";
    const start = await snapshot(req.userId);
    if (start.odometer == null) {
      return res.status(409).json({ error: "vehicle_asleep", detail: "Wake your vehicle first, then begin the mission." });
    }
    const mission = {
      id: crypto.randomUUID(),
      number: missions.length + 1,
      status: "active",
      category,
      start,
      startedAt: start.at,
    };
    missions.push(mission);
    saveMissions(req.userId, missions);
    res.json({ mission });
  } catch (err) {
    res.status(500).json({ error: "start_failed", detail: err.message });
  }
});

router.post("/:id/complete", requireAuth, async (req, res) => {
  try {
    const missions = getMissions(req.userId);
    const mission = missions.find((m) => m.id === req.params.id);
    if (!mission) return res.status(404).json({ error: "not_found" });
    if (mission.status !== "active") return res.json({ mission });

    const end = await snapshot(req.userId);
    if (end.odometer == null) {
      return res.status(409).json({ error: "vehicle_asleep", detail: "Wake your vehicle to complete the mission." });
    }
    if (CATEGORIES.includes(req.body?.category)) mission.category = req.body.category;
    if (!mission.category) mission.category = "family";

    const miles = Math.max(0, +(end.odometer - mission.start.odometer).toFixed(1));
    const batteryDrop = Math.max(0, (mission.start.battery ?? 0) - (end.battery ?? 0));
    const kwh = +((batteryDrop / 100) * PACK_KWH).toFixed(1);
    const cost = +(kwh * RATE_PER_KWH).toFixed(2);
    const gasCost = +((miles / GAS_MPG) * GAS_PRICE).toFixed(2);
    const saved = +Math.max(0, gasCost - cost).toFixed(2);
    const durationMin = Math.round((new Date(end.at) - new Date(mission.startedAt)) / 60000);
    const deduction = mission.category === "business" || mission.category === "rental"
      ? +(miles * IRS_RATE).toFixed(2)
      : 0;

    mission.status = "complete";
    mission.end = end;
    mission.endedAt = end.at;
    mission.fromName = (req.body?.fromName || "").slice(0, 40).toUpperCase() || "LAUNCH SITE";
    mission.toName = (req.body?.toName || "").slice(0, 40).toUpperCase() || "DESTINATION";
    mission.notes = (req.body?.notes || "").slice(0, 200);
    mission.stats = { miles, kwh, cost, saved, durationMin, deduction };
    saveMissions(req.userId, missions);
    res.json({ mission });
  } catch (err) {
    res.status(500).json({ error: "complete_failed", detail: err.message });
  }
});

router.delete("/:id", requireAuth, (req, res) => {
  const missions = getMissions(req.userId).filter((m) => m.id !== req.params.id);
  saveMissions(req.userId, missions);
  res.json({ deleted: true });
});

export default router;
