// ========================================
// Authentication Service
// ========================================
// Implements registration, login, token refresh and logout.
// All password handling goes through bcrypt.
// All token handling goes through the jwt lib.
// ========================================

import bcrypt from "bcryptjs";
import { z } from "zod";
import { type Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  REFRESH_TOKEN_COOKIE,
  getRefreshCookieOptions,
} from "../lib/jwt.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import type { Request, Response } from "express";
import { sendSuccess } from "../utils/response.js";

// ---- Validation schemas ----

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long"),
  organizationName: z.string().min(1, "Organization name is required").max(100),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// ---- Bcrypt cost ----
const BCRYPT_ROUNDS = 12;

// ---- Refresh token version tracking (in-process store for Day 1) ----
// This maps userId → tokenVersion. In production this would be in Redis
// or a DB column. For Day 1, this survives server restarts via DB field.
// We track the token version in the User record via a separate mechanism.
// For simplicity in Day 1 we use a DB-backed tokenVersion on the user.

// ---- Helper: build user response (no password, no sensitive fields) ----
function buildSafeUser(user: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  createdAt: Date;
  organizationId?: string;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    status: user.status,
    organizationId: user.organizationId,
    createdAt: user.createdAt.toISOString(),
  };
}

// ---- Helper: load membership with role and permissions ----
async function getMembership(userId: string, organizationId?: string) {
  const whereClause = organizationId
    ? { userId, organizationId, status: "ACTIVE" as const }
    : { userId, status: "ACTIVE" as const };

  const membership = await prisma.organizationMember.findFirst({
    where: whereClause,
    include: {
      organization: { select: { id: true, name: true, slug: true, status: true } },
      role: {
        include: {
          permissions: {
            include: { permission: { select: { key: true } } },
          },
        },
      },
    },
  });

  return membership;
}

// ---- Helper: issue tokens and set cookie ----
function issueTokens(
  res: Response,
  user: { id: string; email: string },
  membership: {
    organization: { id: string };
    role: {
      id: string;
      name: string;
      permissions: Array<{ permission: { key: string } }>;
    };
  },
  tokenVersion: number
): { accessToken: string; permissions: string[] } {
  const permissions = membership.role.permissions.map((rp) => rp.permission.key);

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    organizationId: membership.organization.id,
    roleId: membership.role.id,
    roleName: membership.role.name,
    permissions,
  });

  const refreshToken = signRefreshToken(user.id, tokenVersion);

  // Set refresh token as HttpOnly cookie
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  res.cookie(
    REFRESH_TOKEN_COOKIE,
    refreshToken,
    getRefreshCookieOptions(SEVEN_DAYS_MS)
  );

  return { accessToken, permissions };
}

// ---- Helper: generate slug from org name ----
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

// ---- Helper: ensure unique slug ----
async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  for (let attempts = 0; attempts < 100; attempts++) {
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (!existing) return slug;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return `${baseSlug}-${Date.now()}`;
}

// ============================================================
// REGISTER
// POST /api/v1/auth/register
// ============================================================

export async function register(req: Request, res: Response): Promise<void> {
  const input = registerSchema.parse(req.body);

  // ---- Check for duplicate email ----
  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    select: { id: true },
  });
  if (existing) {
    throw AppError.conflict("An account with this email already exists");
  }

  // ---- Hash password ----
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  // ---- Find ADMIN role ----
  const adminRole = await prisma.role.findUnique({
    where: { name: "ADMIN" },
    include: {
      permissions: {
        include: { permission: { select: { key: true } } },
      },
    },
  });
  if (!adminRole) {
    logger.error("ADMIN role missing — database may not be seeded");
    throw AppError.internal("System configuration error: roles not initialized");
  }

  // ---- Create user, organization, and membership in a transaction ----
  const baseSlug = generateSlug(input.organizationName);
  const slug = await ensureUniqueSlug(baseSlug);

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
        status: "ACTIVE",
        tokenVersion: 0,
      },
    });

    const organization = await tx.organization.create({
      data: {
        name: input.organizationName,
        slug,
        status: "ACTIVE",
      },
    });

    const membership = await tx.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        roleId: adminRole.id,
        status: "ACTIVE",
      },
    });

    return { user, organization, membership };
  });

  logger.info("User registered", {
    userId: result.user.id,
    organizationId: result.organization.id,
  });

  // ---- Issue tokens ----
  const membershipWithDetails = {
    organization: { id: result.organization.id },
    role: adminRole,
  };

  const { accessToken, permissions } = issueTokens(
    res,
    result.user,
    membershipWithDetails,
    0 // initial token version
  );

  sendSuccess(
    res,
    {
      user: buildSafeUser({
        ...result.user,
        organizationId: result.organization.id,
      }),
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
      },
      role: adminRole.name,
      permissions,
      accessToken,
    },
    201
  );
}

// ============================================================
// LOGIN
// POST /api/v1/auth/login
// ============================================================

export async function login(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);

  // ---- Lookup user (constant-time failure avoids email enumeration) ----
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      status: true,
      passwordHash: true,
      tokenVersion: true,
      createdAt: true,
    },
  });

  // Compare even if user not found (prevents timing attacks)
  const DUMMY_HASH = "$2a$12$dummy.hash.to.prevent.timing.attacks.123456789";
  const passwordMatch = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? DUMMY_HASH
  );

  if (!user || !passwordMatch) {
    throw AppError.unauthorized("Invalid email or password");
  }

  if (user.status !== "ACTIVE") {
    throw AppError.unauthorized("Account is not active");
  }

  // ---- Load membership ----
  const membership = await getMembership(user.id);
  if (!membership) {
    throw AppError.unauthorized("No active organization membership found");
  }

  // ---- Issue tokens ----
  const { accessToken, permissions } = issueTokens(
    res,
    user,
    membership,
    user.tokenVersion
  );

  // ---- Never log password or hash ----
  // Strip sensitive fields before building response
  const safeUser = buildSafeUser({
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    status: user.status,
    createdAt: user.createdAt,
  });

  sendSuccess(res, {
    user: safeUser,
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
    },
    role: membership.role.name,
    permissions,
    accessToken,
  });
}

// ============================================================
// ME
// GET /api/v1/auth/me
// ============================================================

export async function me(req: Request, res: Response): Promise<void> {
  // req.user is guaranteed by requireAuth middleware
  const { userId, organizationId } = req.user!;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      status: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw AppError.unauthorized("User not found");
  }

  const membership = await getMembership(userId, organizationId);
  if (!membership) {
    throw AppError.forbidden("No active organization membership");
  }

  const permissions = membership.role.permissions.map(
    (rp: { permission: { key: string } }) => rp.permission.key
  );

  sendSuccess(res, {
    user: buildSafeUser(user),
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      status: membership.organization.status,
    },
    role: membership.role.name,
    permissions,
  });
}

// ============================================================
// REFRESH
// POST /api/v1/auth/refresh
// ============================================================

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies[REFRESH_TOKEN_COOKIE] as string | undefined;

  if (!token) {
    throw AppError.unauthorized("No refresh token provided");
  }

  const payload = verifyRefreshToken(token);

  // ---- Load user to validate existence ----
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, status: true, tokenVersion: true },
  });

  if (!user || user.status !== "ACTIVE") {
    throw AppError.unauthorized("User not found or inactive");
  }

  // ---- Validate token version — rejects tokens issued before last logout ----
  if (payload.tokenVersion !== user.tokenVersion) {
    throw AppError.unauthorized("Refresh token has been invalidated");
  }

  // ---- Load membership ----
  const membership = await getMembership(user.id);
  if (!membership) {
    throw AppError.unauthorized("No active organization membership");
  }

  // ---- Rotate: issue new pair with same version (logout increments it) ----
  const { accessToken, permissions } = issueTokens(
    res,
    user,
    membership,
    user.tokenVersion
  );

  sendSuccess(res, {
    accessToken,
    permissions,
  });
}

// ============================================================
// LOGOUT
// POST /api/v1/auth/logout
// ============================================================

export async function logout(req: Request, res: Response): Promise<void> {
  // Increment tokenVersion to invalidate all existing refresh tokens
  // Do this even if the user isn't fully authenticated (best effort)
  const user = req.user;
  if (user) {
    await prisma.user
      .update({
        where: { id: user.userId },
        data: { tokenVersion: { increment: 1 } },
      })
      .catch((err: unknown) => {
        // Non-fatal — cookie is still cleared
        logger.warn("Failed to increment tokenVersion on logout", { err });
      });
  }

  // Clear the refresh cookie regardless of whether a valid token is present
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    path: "/api/v1/auth",
  });

  sendSuccess(res, { message: "Logged out successfully" });
}
