# RicozViz

**Enterprise Data Visualization and Exploration Platform**

RicozViz enables organizations to connect to multiple data sources, create interactive dashboards and charts, explore data visually with self-service tools, and publish governed reports with role-based access control.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) · React · TypeScript |
| Styling | Tailwind CSS |
| Backend | Node.js · Express.js · TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Validation | Zod |
| API | REST · Versioned (`/api/v1`) |
| Dev Environment | Docker · Docker Compose |
| CI/CD | GitHub Actions |
| Package Manager | npm Workspaces (monorepo) |

---

## Project Structure

```
RicozViz/
├── apps/
│   ├── web/                 # Next.js frontend (App Router)
│   └── api/                 # Express.js backend
│       ├── prisma/          # Prisma schema & migrations
│       └── src/
│           ├── config/      # Centralized env configuration (Zod-validated)
│           ├── routes/      # Versioned route registrations
│           ├── controllers/ # Request handlers
│           ├── services/    # Business logic (to be added)
│           ├── middleware/  # Error handling, auth guards (to be added)
│           ├── schemas/     # Zod request validation schemas (to be added)
│           └── utils/       # Logger, response helpers, custom errors
│
├── packages/
│   └── shared/              # Shared TypeScript types (ApiResponse, etc.)
│
├── infrastructure/
│   └── docker/              # Additional Dockerfile configs (if needed)
│
├── docs/                    # Architecture and API documentation
│
├── .github/
│   └── workflows/
│       └── ci.yml           # GitHub Actions CI pipeline
│
├── docker-compose.yml       # PostgreSQL (+ optional pgAdmin)
├── .env.example             # Environment variable template
└── package.json             # npm workspaces root
```

---

## Local Development

### Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10
- **Docker Desktop** (for PostgreSQL)

### 1. Clone and install dependencies

```bash
git clone <repo-url> ricozviz
cd ricozviz
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your local values (defaults should work for Docker Compose)
```

### 3. Start PostgreSQL

```bash
npm run docker:up
# OR
docker compose up -d
```

Wait for the health check to pass:
```bash
docker compose ps   # postgres should show "healthy"
```

### 4. Start the backend

```bash
npm run dev:api
# OR
cd apps/api && npm run dev
```

The API will be available at: `http://localhost:4000`

### 5. Start the frontend

Open a new terminal:

```bash
npm run dev:web
# OR
cd apps/web && npm run dev
```

The frontend will be available at: `http://localhost:3000`

---

## Health Check

Verify the API is running:

```bash
curl http://localhost:4000/api/v1/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "ricozviz-api",
    "version": "0.1.0",
    "timestamp": "2026-09-29T13:10:00.000Z",
    "uptime": 42
  }
}
```

A backward-compatible alias is also available:

```bash
curl http://localhost:4000/api/health
# Redirects (301) → /api/v1/health
```

---

## Database (Prisma)

```bash
# Generate Prisma client after schema changes
npm run db:generate

# Push schema to database (dev only, no migration files)
npm run db:push

# Create and apply a migration
npm run db:migrate

# Open Prisma Studio (database GUI)
cd apps/api && npm run db:studio
```

---

## Optional: pgAdmin (Database GUI)

```bash
docker compose --profile tools up -d
```

Then open: `http://localhost:5050`  
Login: `admin@ricozviz.local` / `admin`

---

## Build

```bash
# Build all packages
npm run build

# Build individually
npm run build:api
npm run build:web
```

---

## Code Quality

```bash
# Type check all packages
npm run typecheck

# Lint all packages
npm run lint
```

---

## Development Milestone

**Current status: Day 1, Step 2 — Project Foundation**

- [x] Git repository initialized
- [x] Monorepo structure (npm workspaces)
- [x] Next.js frontend scaffolded
- [x] Express.js backend with health endpoint
- [x] Prisma configured (models coming next)
- [x] Docker Compose with PostgreSQL
- [x] GitHub Actions CI pipeline
- [ ] Authentication (Day 1, Step 3+)
- [ ] Database schema (Day 1, Step 3)
- [ ] RBAC (upcoming)
- [ ] Dashboard builder (upcoming)
