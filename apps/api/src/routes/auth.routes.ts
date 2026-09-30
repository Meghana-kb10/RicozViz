// ========================================
// Auth Routes — /api/v1/auth
// ========================================

import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  register,
  login,
  me,
  refresh,
  logout,
} from "../services/auth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

/**
 * POST /api/v1/auth/register
 * Create a new user + organization. Returns access token + sets refresh cookie.
 * Auth: None (public)
 */
router.post("/register", asyncHandler(register));

/**
 * POST /api/v1/auth/login
 * Authenticate with email + password. Returns access token + sets refresh cookie.
 * Auth: None (public)
 */
router.post("/login", asyncHandler(login));

/**
 * GET /api/v1/auth/me
 * Return current authenticated user with org, role, and permissions.
 * Auth: Required
 */
router.get("/me", requireAuth, asyncHandler(me));

/**
 * POST /api/v1/auth/refresh
 * Exchange refresh cookie for a new access token (token rotation).
 * Auth: None (refresh cookie required)
 */
router.post("/refresh", asyncHandler(refresh));

/**
 * POST /api/v1/auth/logout
 * Clears the refresh cookie. Uses optional auth to invalidate refresh tokens.
 * Auth: Optional (uses access token if present to increment tokenVersion)
 */
router.post("/logout", (req, res, next) => {
  // Try to authenticate but don't fail if token is expired
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    requireAuth(req, res, (err: unknown) => {
      // Ignore auth errors on logout — still clear the cookie
      if (err) req.user = undefined;
      next();
    });
  } else {
    next();
  }
}, asyncHandler(logout));

export default router;
