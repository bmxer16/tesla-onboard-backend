/**
 * BACKEND INTEGRATION PATCH
 * =========================
 *
 * In your existing backend/index.js, add these lines:
 *
 * 1. Near the top with other requires:
 */

const teslaAuthRoutes = require('./routes/teslaAuth');
const teslaVehicleRoutes = require('./routes/teslaVehicles');

/*
 * 2. AFTER you set up your `app` and BEFORE your existing routes:
 */

// Mount Tesla routes
app.use('/api/tesla/auth', teslaAuthRoutes);
app.use('/api/tesla', teslaVehicleRoutes);

/*
 * That's it. The new endpoints will be live alongside your existing ones:
 *
 *   GET  /api/tesla/auth/start
 *   POST /api/tesla/auth/callback
 *   POST /api/tesla/auth/disconnect
 *   GET  /api/tesla/auth/status
 *   GET  /api/tesla/vehicles
 *   GET  /api/tesla/vehicles/:id/data
 *   POST /api/tesla/vehicles/:id/wake
 *   POST /api/tesla/vehicles/:vin/cmd/:command
 *
 * Existing endpoints (mock data, waitlist) keep working unchanged.
 *
 * Required environment variables on Render:
 *   TESLA_CLIENT_ID
 *   TESLA_CLIENT_SECRET
 *   TESLA_REDIRECT_URI=https://tesla-onboard.netlify.app/auth/callback
 *   TOKEN_ENCRYPTION_KEY=<64 hex chars - generate with `openssl rand -hex 32`>
 *   JWT_SECRET=<random 64+ chars - regenerate or reuse existing>
 *   TOKENS_FILE_PATH=/var/data/tesla-tokens.json
 *   TESLA_PROXY_URL=<Tesla proxy URL or leave unset to use Tesla API directly>
 *
 * For TOKENS_FILE_PATH to persist, you need a Render Disk attached at /var/data.
 * On Starter plan ($7/mo): create a 1GB disk, mount at /var/data.
 */
