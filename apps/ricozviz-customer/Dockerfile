# ==============================================================================
# RicozViz Customer Portal - Multi-Stage Production Dockerfile (Next.js 15)
# ==============================================================================

FROM node:22-alpine AS base
WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apk add --no-cache libc6-compat wget
RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

# ---- Builder Stage ----
FROM base AS builder
WORKDIR /app
ENV NODE_ENV=development

# Copy workspace definition and package manifests
COPY .npmrc package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/components/package.json ./packages/components/
COPY packages/database/package.json ./packages/database/
COPY packages/tailwind-config/package.json ./packages/tailwind-config/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/validation/package.json ./packages/validation/
COPY apps/ricozviz-customer/package.json ./apps/ricozviz-customer/

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy source trees
COPY packages/ ./packages/
COPY apps/ricozviz-customer/ ./apps/ricozviz-customer/

# Bake client-side public configuration at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_APP_NAME="RicozViz Customer"
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

# Build standalone Next.js bundle
RUN NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 pnpm --filter ricozviz-customer build && \
    mkdir -p /app/apps/ricozviz-customer/public

# ---- Production Runner Stage ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

RUN apk add --no-cache wget

# Create non-root system user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output and static assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/ricozviz-customer/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/ricozviz-customer/.next/static ./apps/ricozviz-customer/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/ricozviz-customer/public ./apps/ricozviz-customer/public

USER nextjs

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://localhost:3001/login || exit 1

CMD ["node", "apps/ricozviz-customer/server.js"]
