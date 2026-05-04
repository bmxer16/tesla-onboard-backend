import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WAITLIST_FILE = path.join(__dirname, "..", "..", "waitlist.json");

const router = Router();

function loadWaitlist() {
  try {
    return JSON.parse(fs.readFileSync(WAITLIST_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveWaitlist(list) {
  try {
    fs.writeFileSync(WAITLIST_FILE, JSON.stringify(list, null, 2));
  } catch (err) {
    console.error("Failed to write waitlist:", err);
  }
}

router.post("/", (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email" });
  }

  const list = loadWaitlist();
  const exists = list.find((e) => e.email.toLowerCase() === email.toLowerCase());
  if (!exists) {
    list.push({ email, joinedAt: new Date().toISOString() });
    saveWaitlist(list);
  }

  res.json({ ok: true });
});

// Optional admin endpoint — protect this in production with a real admin auth check.
router.get("/", (_req, res) => {
  res.json({ count: loadWaitlist().length });
});

export default router;
