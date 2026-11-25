# RicozViz Deployment Guide

You can deploy **RicozViz** in two ways from scratch:
- **Option A (Recommended Free/PaaS Cloud Stack)**: **MongoDB Atlas + Render + Vercel**
- **Option B (Single Linux VPS / Self-Hosted)**: **Docker Compose + Caddy**

---

## Option A: Deploy on MongoDB Atlas + Render + Vercel

> **Important**: RicozViz uses **MongoDB (Mongoose)** as its application database—not PostgreSQL/Neon. (Once deployed, you can still connect **Neon** or any PostgreSQL warehouse inside the UI under **Data Sources**.)

### Step 1: Create Database on MongoDB Atlas
1. Create a free **M0 cluster** at [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Under **Database Access**, create a database user + password.
3. Under **Network Access**, add `0.0.0.0/0` (required for Render dynamic outbound IPs).
4. Copy your connection string and ensure `/ricozviz` is included before `?`, e.g.:
   ```text
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/ricozviz?retryWrites=true&w=majority
   ```

---

### Step 2: Deploy Backend API on Render (`apps/backend`)
1. Go to [Render](https://render.com) → **New → Blueprint** (uses [render.yaml](./render.yaml) automatically) **OR** **New → Web Service** connected to `Meghana-kb10/RicozViz` (`develop` branch):
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `./apps/backend/Dockerfile`
   - **Docker Context**: `.`
   - **Health Check Path**: `/api/v1/health`
2. Set/confirm environment variables on the Render service:
   - `NODE_ENV` = `production`
   - `PORT` = `4000`
   - `HOST` = `0.0.0.0`
   - `MONGODB_URI` = *(your MongoDB Atlas URI from Step 1)*
   - `MONGODB_DB_NAME` = `ricozviz`
   - `JWT_SECRET` = *(generate with `openssl rand -hex 32` or Render auto-generate)*
   - `JWT_ADMIN_SECRET` = *(generate with `openssl rand -hex 32` — **save this exact value**, you also need it in Vercel Admin)*
   - `CREDENTIAL_ENC_KEY` = *(generate with `openssl rand -hex 32`)*
   - `CREDENTIAL_ENC_KEY_VERSION` = `1`
   - `ACTIVE_ENCRYPTION_KEY_VERSION` = `1`
   - `WEB_APP_URL` = *(temporary placeholder until Step 3, then update to your Customer Vercel URL)*
   - `CORS_ORIGIN` = *(temporary placeholder until Step 3/4, then update to `<CUSTOMER_VERCEL_URL>,<ADMIN_VERCEL_URL>`)*
3. Wait for Render to build & deploy, and note your Render URL, e.g.:
   `https://ricozviz-api.onrender.com`
   Verify it returns `200 OK`: `https://ricozviz-api.onrender.com/api/v1/health`

*(Optional)*: Background scheduled reports/alerts (`apps/backend/Dockerfile.worker`) can be deployed later as a **Render Background Worker** (requires a Render paid instance) pointing to the same `MONGODB_URI` and encryption keys.

---

### Step 3: Deploy Customer Portal on Vercel (`apps/ricozviz-customer`)
1. Go to [Vercel](https://vercel.com) → **Add New → Project** → import `Meghana-kb10/RicozViz`.
2. Configure **Project Settings**:
   - **Root Directory**: `apps/ricozviz-customer`
   - **Node.js Version**: `22.x`
   - *(Build/install commands are configured via `apps/ricozviz-customer/vercel.json`)*
3. Add **Environment Variables**:
   - `BACKEND_API_URL` = `https://ricozviz-api.onrender.com` *(your Render URL; enables first-party same-origin `/api/v1/*` proxying on Vercel so `HttpOnly` `SameSite=Strict` refresh cookies work cleanly)*
   - `NEXT_PUBLIC_WS_URL` = `https://ricozviz-api.onrender.com` *(optional — enables direct WebSocket collaboration presence to Render; otherwise SSE/polling fallback runs over HTTPS)*
4. Deploy and copy your Customer Vercel URL (e.g. `https://ricozviz-customer.vercel.app`).

---

### Step 4: Deploy Admin Portal on Vercel (`apps/ricozviz-admin`)
1. In Vercel → **Add New → Project** → import the same repo `Meghana-kb10/RicozViz`.
2. Configure **Project Settings**:
   - **Root Directory**: `apps/ricozviz-admin`
   - **Node.js Version**: `22.x`
   - *(Build/install commands are configured via `apps/ricozviz-admin/vercel.json`)*
3. Add **Environment Variables**:
   - `ADMIN_API_ORIGIN` = `https://ricozviz-api.onrender.com` *(your Render URL)*
   - `JWT_ADMIN_SECRET` = *(MUST match the exact `JWT_ADMIN_SECRET` set on Render in Step 2!)*
4. Deploy and copy your Admin Vercel URL (e.g. `https://ricozviz-admin.vercel.app`).

---

### Step 5: Link Vercel URLs Back on Render & Create First Admin
1. Back in **Render → Environment**, update:
   - `WEB_APP_URL` = `https://ricozviz-customer.vercel.app`
   - `CORS_ORIGIN` = `https://ricozviz-customer.vercel.app,https://ricozviz-admin.vercel.app`
   *(Render restarts automatically on env change.)*
2. Seed your first Platform Admin user against your MongoDB Atlas database (from your local terminal, or Render Shell on paid plans):
   ```bash
   # From your local repo checkout:
   MONGODB_URI="<your_atlas_uri>" \
   JWT_SECRET="<same_jwt_secret>" \
   JWT_ADMIN_SECRET="<same_jwt_admin_secret>" \
   CREDENTIAL_ENC_KEY="<same_enc_key>" \
   pnpm --filter backend seed:admin -- \
     --email "admin@yourdomain.com" \
     --password "ChangeMe#StrongPass123" \
     --name "Platform Admin"
   ```
3. Open your Admin Vercel URL → log in → scan the TOTP 2FA QR code and save your backup codes.

> **Note**: Whenever you change `BACKEND_API_URL`, `ADMIN_API_ORIGIN`, or `NEXT_PUBLIC_*` on Vercel, trigger a **Redeploy** so Next.js picks up the updated rewrite target.

---

## Option B: Deploy on a Single Linux VPS (Docker Compose + Caddy)

### 1. Server Requirements
- Fresh Ubuntu 22.04/24.04 or Debian 12 VM (minimum **2 vCPU / 4 GB RAM / 25 GB disk**)
- Open firewall ports: `22`, `80`, `443`

### 2. Install Docker & Clone
```bash
sudo apt-get update && sudo apt-get install -y git curl ca-certificates
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

git clone -b develop https://github.com/Meghana-kb10/RicozViz.git
cd RicozViz
```

### 3. Configure `.env`
```bash
cp .env.example .env
openssl rand -hex 32   # Key 1 -> JWT_SECRET
openssl rand -hex 32   # Key 2 -> JWT_ADMIN_SECRET
openssl rand -hex 32   # Key 3 -> CREDENTIAL_ENC_KEY & ENCRYPTION_MASTER_KEY_V1
```
Edit `.env` with those secrets plus `MONGODB_URI=mongodb://mongo:27017/ricozviz`, `REDIS_URL=redis://redis:6379`, and your domain URLs (`WEB_APP_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ADMIN_API_URL`, `CORS_ORIGIN`). Update `deploy/docker/Caddyfile` with your domains if using HTTPS.

### 4. Build, Boot & Seed Admin
```bash
docker compose build
docker compose up -d
docker compose ps
curl -fs http://localhost:4000/api/v1/health

docker compose exec backend node apps/backend/dist/scripts/create-platform-admin.js \
  --email "admin@yourdomain.com" \
  --password "ChangeMe#StrongPass123" \
  --name "Platform Admin"
```
