// ---- Load environment variables FIRST (before any other imports) ----
import * as dotenv from "dotenv";
import * as path from "path";
// Walk up to monorepo root (.env sits next to apps/ and packages/)
const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });


import { config } from "./config/env.js";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";

const app = createApp();

const server = app.listen(config.PORT, () => {
  logger.info(`🚀 RicozViz API started`, {
    port: config.PORT,
    env: config.NODE_ENV,
    health: `http://localhost:${config.PORT}/api/v1/health`,
  });
});

// ---- Graceful shutdown ----
function shutdown(signal: string): void {
  logger.info(`Received ${signal} — shutting down gracefully...`);
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Promise Rejection", { reason });
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", { error: error.message, stack: error.stack });
  process.exit(1);
});

export default server;
