// ========================================
// Express Application Factory
// ========================================

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";

import { config } from "./config/env.js";
import v1Router from "./routes/index.js";
import {
  notFoundHandler,
  globalErrorHandler,
} from "./middleware/errorHandler.js";

export function createApp(): express.Application {
  const app = express();

  // ---- Security headers ----
  app.use(helmet());

  // ---- CORS ----
  app.use(
    cors({
      origin:
        config.NODE_ENV === "production"
          ? process.env["ALLOWED_ORIGIN"] ?? "https://ricozviz.com"
          : ["http://localhost:3000", "http://127.0.0.1:3000"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // ---- Compression ----
  app.use(compression());

  // ---- Request parsing ----
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // ---- HTTP request logging ----
  app.use(
    morgan(config.NODE_ENV === "production" ? "combined" : "dev")
  );

  // ---- Root redirect to v1 ----
  app.get("/", (_req, res) => {
    res.redirect("/api/v1");
  });

  // ---- Backward-compatible health alias ----
  // /api/health → /api/v1/health (for monitoring tools)
  app.get("/api/health", (_req, res) => {
    res.redirect(301, "/api/v1/health");
  });

  // ---- Versioned API ----
  app.use("/api/v1", v1Router);

  // ---- 404 handler — must be AFTER all valid routes ----
  app.use(notFoundHandler);

  // ---- Global error handler — must be LAST ----
  app.use(globalErrorHandler);

  return app;
}
