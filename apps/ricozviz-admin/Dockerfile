# ==============================================================================
# RicozViz Operator Admin Portal - Multi-Stage Production Dockerfile (Next.js 15)
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
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/components/package.json ./packages/components/
COPY packages/database/package.json ./packages/database/
COPY packages/tailwind-config/package.json ./packages/tailwind-config/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/validation/package.json ./packages/validation/
COPY apps/ricozviz-admin/package.json ./apps/ricozviz-admin/

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy source trees
COPY packages/ ./packages/
COPY apps/ricozviz-admin/ ./apps/ricozviz-admin/

# Build standalone Next.js bundle
RUN pnpm --filter ricozviz-admin build

# ---- Production Runner Stage ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

RUN apk add --no-cache wget

# Create non-root system user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output and static assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/ricozviz-admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/ricozviz-admin/.next/static ./apps/ricozviz-admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/ricozviz-admin/public ./apps/ricozviz-admin/public

USER nextjs

EXPOSE 3002

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://localhost:3002/login || exit 1

CMD ["node", "apps/ricozviz-admin/server.js"]
