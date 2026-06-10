/**
 * Mission Store — file-based persistence on Render disk.
 * Same pattern as tokenStore: JSON file, atomic write via tmp+rename.
 */
import fs from "fs";
import path from "path";

const FILE =
  process.env.MISSIONS_FILE_PATH ||
  (fs.existsSync("/var/data") ? "/var/data/missions.json" : path.resolve("./missions.json"));

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

function save(db) {
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

export function getMissions(userId) {
  const db = load();
  return db[userId] || [];
}

export function saveMissions(userId, missions) {
  const db = load();
  db[userId] = missions;
  save(db);
}
