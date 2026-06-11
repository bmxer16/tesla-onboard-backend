import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as teslaApi from "./teslaApi.js";
import { getMissions, saveMissions } from "./missionStore.js";

const TOKENS = process.env.TOKENS_FILE_PATH || "/var/data/tesla-tokens.json";
const WATCH_FILE = path.join(path.dirname(TOKENS), "trip-watch.json");
const PACK_KWH = 75, RATE_PER_KWH = 0.16, GAS_MPG = 30, GAS_PRICE = 4.8;

function loadWatch() { try { return JSON.parse(fs.readFileSync(WATCH_FILE, "utf8")); } catch { return {}; } }
function saveWatch(w) { try { const t = WATCH_FILE + ".tmp"; fs.writeFileSync(t, JSON.stringify(w)); fs.renameSync(t, WATCH_FILE); } catch (e) { console.error("watch save", e.message); } }
function userIds() { try { return Object.keys(JSON.parse(fs.readFileSync(TOKENS, "utf8"))); } catch { return []; } }

async function checkUser(userId, watch) {
  const vehicles = await teslaApi.listVehicles(userId);
  const v = vehicles && vehicles[0];
  if (!v || v.state !== "online") return;
  const id = v.id_s || v.id;
  const data = await teslaApi.getVehicleData(userId, id);
  const odo = data?.vehicle_state?.odometer;
  if (odo == null) return;
  const snap = { odometer: odo, battery: data?.charge_state?.battery_level ?? null, lat: data?.drive_state?.latitude ?? null, lon: data?.drive_state?.longitude ?? null, at: new Date().toISOString(), vehicleName: v.display_name, vin: v.vin };
  const last = watch[userId];
  watch[userId] = snap;
  if (!last) return;
  const missions = getMissions(userId);
  if (missions.find((m) => m.status === "active")) return;
  const miles = +(odo - last.odometer).toFixed(1);
  if (miles < 1) return;
  const batteryDrop = Math.max(0, (last.battery ?? 0) - (snap.battery ?? 0));
  const kwh = +((batteryDrop / 100) * PACK_KWH).toFixed(1);
  const cost = +(kwh * RATE_PER_KWH).toFixed(2);
  const gasCost = +((miles / GAS_MPG) * GAS_PRICE).toFixed(2);
  const saved = +Math.max(0, gasCost - cost).toFixed(2);
  const durationMin = Math.round((new Date(snap.at) - new Date(last.at)) / 60000);
  missions.push({
    id: crypto.randomUUID(), number: missions.length + 1, status: "complete",
    category: "unclassified", recorded: true,
    start: last, startedAt: last.at, end: snap, endedAt: snap.at,
    fromName: "RECORDED TRIP", toName: "TAP TO EDIT",
    stats: { miles, kwh, cost, saved, durationMin, deduction: 0 },
  });
  saveMissions(userId, missions);
  console.log("Recorded trip:", userId, miles, "mi");
}

export function startTripWatcher() {
  setInterval(async () => {
    const watch = loadWatch();
    for (const uid of userIds()) { try { await checkUser(uid, watch); } catch (e) {} }
    saveWatch(watch);
  }, 10 * 60 * 1000);
  console.log("Trip watcher running (10 min interval)");
}
