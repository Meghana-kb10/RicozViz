# RicozViz Deployment Guide (Fresh Setup from Scratch)

This guide explains how to deploy **RicozViz** (Backend API, Background Worker, Customer Portal, Admin Portal, MongoDB, Redis, and Caddy Reverse Proxy) on any fresh Linux server / VPS (Ubuntu 22.04/24.04 or Debian 12) from scratch using Docker Compose.

---

## 1. Server Requirements

- **Server**: Fresh Linux VPS (minimum **2 vCPU / 4 GB RAM / 25 GB disk** recommended for building Next.js & Node.js containers)
- **Software**: Git + Docker Engine + Docker Compose v2
- **Ports to open in your server firewall / security group**:
  - `22` (SSH)
  - `80` (HTTP) & `443` (HTTPS) — for Caddy reverse proxy
  - *(Optional, only if accessing ports directly without Caddy)*: `3001` (Customer), `3002` (Admin), `4000` (API)
- **Domain DNS** *(recommended for production HTTPS)*:
  Create `A` records pointing to your server's public IP:
  - `yourdomain.com` -> `<SERVER_IP>` (Customer Portal)
  - `admin.yourdomain.com` -> `<SERVER_IP>` (Admin Portal)
  - `api.yourdomain.com` -> `<SERVER_IP>` (Backend API)

---

## 2. Install Docker & Clone the Repository

SSH into your server and install Docker + Git:

```bash
sudo apt-get update && sudo apt-get install -y git curl ca-certificates
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Log out and back in (or run `newgrp docker`) so docker works without sudo
```

Clone your repository (`develop` branch):

```bash
git clone -b develop https://github.com/Meghana-kb10/RicozViz.git
cd RicozViz
```

---

## 3. Generate Secrets & Configure `.env`

Create a root `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Generate three fresh 256-bit cryptographic keys (run each command and save the output):

```bash
openssl rand -hex 32   # use for JWT_SECRET
openssl rand -hex 32   # use for JWT_ADMIN_SECRET
openssl rand -hex 32   # use for CREDENTIAL_ENC_KEY (and ENCRYPTION_MASTER_KEY_V1)
```

Edit `.env` and set your secrets and URLs:

```env
NODE_ENV=production

# Cryptographic Secrets (paste the 3 keys generated above)
JWT_SECRET=<your_generated_jwt_secret>
JWT_ADMIN_SECRET=<your_generated_admin_secret>
CREDENTIAL_ENC_KEY=<your_generated_encryption_key>
CREDENTIAL_ENC_KEY_VERSION=1
ENCRYPTION_MASTER_KEY_V1=<same_encryption_key>
ACTIVE_ENCRYPTION_KEY_VERSION=1

# Database / Cache (Docker internal hostnames)
MONGODB_URI=mongodb://mongo:27017/ricozviz
REDIS_URL=redis://redis:6379
POSTGRES_PASSWORD=<choose_a_strong_postgres_password>

# Public Domains (replace with your real domains, or http://<SERVER_IP>:4000 etc. for IP testing)
WEB_APP_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_ADMIN_API_URL=https://api.yourdomain.com
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com
```

> **Security Note**: Never commit `.env` to Git. Keep `JWT_ADMIN_SECRET` strictly server-side (never prefix it with `NEXT_PUBLIC_`).

---

## 4. Configure Domains & HTTPS in Caddy (Optional for Custom Domains)

Open `deploy/docker/Caddyfile` and replace the local hostnames (`api.ricozviz.localhost`, `admin.ricozviz.localhost`, `ricozviz.localhost`) with your real domain names, and remove `tls internal` so Caddy automatically provisions free Let's Encrypt SSL certificates:

```caddyfile
api.yourdomain.com {
    reverse_proxy backend:4000
}

admin.yourdomain.com {
    reverse_proxy admin:3002
}

yourdomain.com {
    handle /api/* {
        reverse_proxy backend:4000
    }
    handle {
        reverse_proxy customer:3001
    }
}
```

*(If you are just testing locally on the same machine, you can leave `deploy/docker/Caddyfile` as-is and access `http://localhost:3001`, `http://localhost:3002`, and `http://localhost:4000` directly.)*

---

## 5. Build & Start All Services

```bash
docker compose build
docker compose up -d
```

Check container status (wait ~30 seconds for all healthchecks to turn `healthy`):

```bash
docker compose ps
```

Verify live endpoints:

```bash
curl -fs http://localhost:4000/api/v1/health
```

---

## 6. Create Your First Platform Admin Account

Run the built-in admin seed CLI inside the running `backend` container (password must be 12+ characters with uppercase, lowercase, number, and special character):

```bash
docker compose exec backend node apps/backend/dist/scripts/create-platform-admin.js \
  --email "admin@yourdomain.com" \
  --password "ChangeMe#StrongPass123" \
  --name "Platform Admin"
```

1. Open the Admin Portal (`https://admin.yourdomain.com` or `http://localhost:3002`).
2. Log in with the email and password above.
3. Complete the mandatory **TOTP 2FA enrollment** by scanning the QR code with an authenticator app (Google Authenticator / 1Password / Authy) and save your backup codes.

---

## 7. Updating Later

When you push new changes to `develop`:

```bash
cd RicozViz
git pull origin develop
docker compose build
docker compose up -d
```

To view logs or restart a single service:

```bash
docker compose logs -f backend worker customer admin
docker compose restart backend
```
