// ========================================
// Central Route Registration — /api/v1
// ========================================

import { Router, type Request, type Response } from "express";
import healthRouter from "./health.routes.js";

const v1Router = Router();

// ---- Route registrations ----
v1Router.use("/health", healthRouter);

// Future routes will be added here:
// v1Router.use("/auth",         authRouter);
// v1Router.use("/users",        usersRouter);
// v1Router.use("/organizations",orgRouter);
// v1Router.use("/data-sources", dataSourcesRouter);
// v1Router.use("/dashboards",   dashboardsRouter);

// ---- /api/v1 index ----
v1Router.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      version: "v1",
      endpoints: ["/api/v1/health"],
    },
  });
});

export default v1Router;
