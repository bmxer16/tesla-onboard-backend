import { Router } from "express";
import jwt from "jsonwebtoken";

const router = Router();

// =====================================================================
// PLACEHOLDER LOGIN
// =====================================================================
// In production, replace this entire route with Tesla's OAuth 2.0 PKCE flow:
//   1. Redirect user to https://auth.tesla.com/oauth2/v3/authorize
//   2. User authenticates with Tesla and approves your app's scopes
//   3. Tesla redirects back to your callback with a code
//   4. Exchange code at https://auth.tesla.com/oauth2/v3/token for access_token
//   5. Use that access_token as Bearer for all Fleet API calls
//
// Docs: https://developer.tesla.com/docs/fleet-api/authentication/overview
// =====================================================================

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  // Mock: accept anything, issue a JWT.
  const token = jwt.sign(
    { email, sub: "mock-user-id" },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "7d" }
  );

  return res.json({
    access_token: token,
    token_type: "Bearer",
    expires_in: 60 * 60 * 24 * 7,
    user: { email },
  });
});

router.post("/logout", (_req, res) => {
  // With JWT there's nothing server-side to invalidate unless you add a blocklist.
  // Real Tesla flow would call the revoke endpoint here.
  return res.json({ ok: true });
});

export default router;
