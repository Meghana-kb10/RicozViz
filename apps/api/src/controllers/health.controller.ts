// ========================================
// Health Check Controller
// ========================================

import type { Request, Response } from "express";
import { sendSuccess } from "../utils/response.js";
import type { HealthCheckData } from "../types/api.types.js";

const SERVICE_NAME = "ricozviz-api";
const SERVICE_VERSION = "0.1.0";
const startTime = Date.now();

/**
 * GET /api/v1/health
 *
 * Returns service health status.
 * Does NOT require authentication — monitoring tools need open access.
 */
export function healthCheck(req: Request, res: Response): void {
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  const data: HealthCheckData = {
    status: "ok",
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    timestamp: new Date().toISOString(),
    uptime,
  };

  sendSuccess(res, data);
}
