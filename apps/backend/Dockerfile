# ==============================================================================
# RicozViz Fastify API - Multi-Stage Production Dockerfile
# ==============================================================================

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

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
COPY apps/backend/package.json ./apps/backend/

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy source trees
COPY packages/ ./packages/
COPY apps/backend/ ./apps/backend/

# Build packages and backend
RUN pnpm --filter backend build

# ---- Production Runner Stage ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

# Install runtime tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Run as non-root user
RUN groupadd --system --gid 1001 ricozviz && \
    useradd --system --uid 1001 -g ricozviz ricozviz

# Copy built artifacts and modules
COPY --from=builder --chown=ricozviz:ricozviz /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder --chown=ricozviz:ricozviz /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder --chown=ricozviz:ricozviz /app/node_modules ./node_modules
COPY --from=builder --chown=ricozviz:ricozviz /app/packages ./packages

USER ricozviz

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fs http://localhost:4000/health || exit 1

CMD ["node", "apps/backend/dist/index.js"]
