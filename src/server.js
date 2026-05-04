import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import vehicleRoutes from "./routes/vehicles.js";
import commandRoutes from "./routes/commands.js";
import waitlistRoutes from "./routes/waitlist.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "tesla-onboard-backend", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/vehicles", commandRoutes); // commands also live under /vehicles/:id/command/*
app.use("/api/waitlist", waitlistRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Tesla Onboard backend listening on :${PORT}`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);
});
