// ========================================
// Health Routes — /api/v1/health
// ========================================

import { Router } from "express";
import { healthCheck } from "../controllers/health.controller.js";

const router = Router();

/**
 * GET /api/v1/health
 * Returns service health information.
 * Auth: None (public)
 */
router.get("/", healthCheck);

export default router;
