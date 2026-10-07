ALTER TABLE "dashboards" ADD COLUMN "shareExpiresAt" TIMESTAMP(3);

CREATE INDEX "dashboards_shareTokenActive_shareExpiresAt_idx"
ON "dashboards"("shareTokenActive", "shareExpiresAt");
