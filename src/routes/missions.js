import express from "express";
import crypto from "crypto";
import * as teslaApi from "../lib/teslaApi.js";
import { requireAuth } from "../lib/session.js";
import { getMissions, saveMissions } from "../lib/missionStore.js";

const router = express.Router();
const PACK_KWH = 75, RATE_PER_KWH = 0.16, GAS_MPG = 30, GAS_PRICE = 4.8, IRS_RATE = 0.725;
const CATEGORIES = ["business", "rental", "family", "vacation", "roadtrip"];

async function snapshot(userId) {
  const vehicles = await teslaApi.listVehicles(userId);
  const v = vehicles[0];
  if (!v) throw new Error("no_vehicle");
  const id = v.id_s || v.id;
  const data = await teslaApi.getVehicleData(userId, id);
  return {
    vehicleName: v.display_name, vin: v.vin,
    odometer: data?.vehicle_state?.odometer ?? null,
    battery: data?.charge_state?.battery_level ?? null,
    lat: data?.drive_state?.latitude ?? null,
    lon: data?.drive_state?.longitude ?? null,
    at: new Date().toISOString(),
  };
}

async function geocode(lat, lon) {
  if (lat == null || lon == null) return null;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=17`, { headers: { "User-Agent": "tesla-onboard/1.0 (hello@dunamisgrowthpartners.com)" } });
    const j = await r.json();
    const a = j.address || {};
    const road = a.road || a.neighbourhood || a.suburb || "";
    const city = a.city || a.town || a.village || a.county || "";
    const name = [road, city].filter(Boolean).join(", ");
    return name ? name.toUpperCase().slice(0, 40) : null;
  } catch { return null; }
}

function distKm(a, b, c, d) {
  const R = 6371, dLat = (c - a) * Math.PI / 180, dLon = (d - b) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function nearbyName(missions, lat, lon) {
  if (lat == null) return null;
  for (const m of missions) {
    const pairs = [[m.start, m.fromName], [m.end, m.toName]];
    for (const [snap, nm] of pairs) {
      if (snap && snap.lat != null && nm && nm !== "LAUNCH SITE" && nm !== "DESTINATION" && distKm(lat, lon, snap.lat, snap.lon) < 0.2) return nm;
    }
  }
  return null;
}

router.get("/", requireAuth, (req, res) => {
  const missions = getMissions(req.userId);
  res.json({ missions: [...missions].reverse(), active: missions.find((m) => m.status === "active") || null, irsRate: IRS_RATE });
});

router.post("/start", requireAuth, async (req, res) => {
  try {
    const missions = getMissions(req.userId);
    const existing = missions.find((m) => m.status === "active");
    if (existing) return res.json({ mission: existing, alreadyActive: true });
    const category = CATEGORIES.includes(req.body?.category) ? req.body.category : "family";
    const start = await snapshot(req.userId);
    if (start.odometer == null) return res.status(409).json({ error: "vehicle_asleep", detail: "Wake your vehicle first." });
    const mission = { id: crypto.randomUUID(), number: missions.length + 1, status: "active", category, start, startedAt: start.at };
    missions.push(mission);
    saveMissions(req.userId, missions);
    res.json({ mission });
  } catch (err) { res.status(500).json({ error: "start_failed", detail: err.message }); }
});

router.post("/:id/complete", requireAuth, async (req, res) => {
  try {
    const missions = getMissions(req.userId);
    const mission = missions.find((m) => m.id === req.params.id);
    if (!mission) return res.status(404).json({ error: "not_found" });
    if (mission.status !== "active") return res.json({ mission });
    const end = await snapshot(req.userId);
    if (end.odometer == null) return res.status(409).json({ error: "vehicle_asleep", detail: "Wake your vehicle to complete." });
    if (CATEGORIES.includes(req.body?.category)) mission.category = req.body.category;
    if (!mission.category) mission.category = "family";
    let fromName = (req.body?.fromName || "").slice(0, 40).toUpperCase();
    let toName = (req.body?.toName || "").slice(0, 40).toUpperCase();
    if (!fromName) fromName = nearbyName(missions, mission.start.lat, mission.start.lon) || await geocode(mission.start.lat, mission.start.lon) || "LAUNCH SITE";
    if (!toName) toName = nearbyName(missions, end.lat, end.lon) || await geocode(end.lat, end.lon) || "DESTINATION";
    const miles = Math.max(0, +(end.odometer - mission.start.odometer).toFixed(1));
    const batteryDrop = Math.max(0, (mission.start.battery ?? 0) - (end.battery ?? 0));
    const kwh = +((batteryDrop / 100) * PACK_KWH).toFixed(1);
    const cost = +(kwh * RATE_PER_KWH).toFixed(2);
    const gasCost = +((miles / GAS_MPG) * GAS_PRICE).toFixed(2);
    const saved = +Math.max(0, gasCost - cost).toFixed(2);
    const durationMin = Math.round((new Date(end.at) - new Date(mission.startedAt)) / 60000);
    const deduction = mission.category === "business" || mission.category === "rental" ? +(miles * IRS_RATE).toFixed(2) : 0;
    Object.assign(mission, { status: "complete", end, endedAt: end.at, fromName, toName, notes: (req.body?.notes || "").slice(0, 200), stats: { miles, kwh, cost, saved, durationMin, deduction } });
    saveMissions(req.userId, missions);
    res.json({ mission });
  } catch (err) { res.status(500).json({ error: "complete_failed", detail: err.message }); }
});

router.patch("/:id/category", requireAuth, (req, res) => {
  const missions = getMissions(req.userId);
  const mission = missions.find((m) => m.id === req.params.id);
  if (!mission || mission.status !== "complete") return res.status(404).json({ error: "not_found" });
  const cat = req.body?.category;
  if (!CATEGORIES.includes(cat)) return res.status(400).json({ error: "bad_category" });
  const day = (d) => new Date(d).toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" });
  if (day(mission.endedAt) !== day(Date.now())) return res.status(403).json({ error: "locked" });
  mission.category = cat;
  const miles = mission.stats?.miles || 0;
  mission.stats.deduction = cat === "business" || cat === "rental" ? +(miles * IRS_RATE).toFixed(2) : 0;
  saveMissions(req.userId, missions);
  res.json({ mission });
});

router.patch("/:id/route", requireAuth, (req, res) => {
  const missions = getMissions(req.userId);
  const mission = missions.find((m) => m.id === req.params.id);
  if (!mission || mission.status !== "complete") return res.status(404).json({ error: "not_found" });
  if (req.body?.fromName) mission.fromName = String(req.body.fromName).slice(0, 40).toUpperCase();
  if (req.body?.toName) mission.toName = String(req.body.toName).slice(0, 40).toUpperCase();
  saveMissions(req.userId, missions);
  res.json({ mission });
});

router.delete("/:id", requireAuth, (req, res) => {
  const missions = getMissions(req.userId).filter((m) => m.id !== req.params.id);
  saveMissions(req.userId, missions);
  res.json({ deleted: true });
});

export default router;
