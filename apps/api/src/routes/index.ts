// ========================================
// Central Route Registration — /api/v1
// ========================================

import { Router, type Request, type Response } from "express";
import healthRouter from "./health.routes.js";
import authRouter from "./auth.routes.js";
import dataSourceRouter from "./data-source.routes.js";
import datasetRouter from "./dataset.routes.js";
import dashboardRouter from "./dashboard.routes.js";
import workspaceRouter from "./workspace.routes.js";
import visualizationRouter from "./visualization.routes.js";
import metricRouter from "./metric.routes.js";
import alertRouter from "./alert.routes.js";

const v1Router = Router();

// ---- Route registrations ----
v1Router.use("/health", healthRouter);
v1Router.use("/auth", authRouter);
v1Router.use("/workspaces", workspaceRouter);
v1Router.use("/data-sources", dataSourceRouter);
v1Router.use("/datasets", datasetRouter);
v1Router.use("/dashboards", dashboardRouter);
v1Router.use("/visualizations", visualizationRouter);
v1Router.use("/metrics", metricRouter);
v1Router.use("/alerts", alertRouter);

// Future routes will be added here:
// v1Router.use("/users",        usersRouter);
// v1Router.use("/organizations",orgRouter);

// ---- /api/v1 index ----
v1Router.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      version: "v1",
      endpoints: [
        "/api/v1/health",
        "/api/v1/auth",
        "/api/v1/workspaces",
        "/api/v1/data-sources",
        "/api/v1/datasets",
        "/api/v1/dashboards",
        "/api/v1/visualizations",
        "/api/v1/metrics",
        "/api/v1/alerts",
      ],
    },
  });
});

export default v1Router;
