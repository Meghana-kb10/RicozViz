// ==============================================================================
// CLI Seed Script: Create Platform Admin
// ==============================================================================
// Creates or promotes a user to PLATFORM_ADMIN with strong password enforcement.
// Run directly:
//   pnpm --filter backend seed:admin -- --email admin@ricozviz.io --password "Str0ngAdmin#Pass123" --name "Super Admin"
// Or via environment variables:
//   ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD, ADMIN_SEED_NAME
// ==============================================================================

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase, UserModel } from '@repo/database';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface CreatePlatformAdminOptions {
  email?: string;
  password?: string;
  name?: string;
}

const BCRYPT_ROUNDS = 12;

export function validateAdminPassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 12) {
    return { valid: false, error: 'Password must be at least 12 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least 1 uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least 1 lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least 1 number.' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: 'Password must contain at least 1 special character.' };
  }
  return { valid: true };
}

export function parseArgs(argv: string[]): CreatePlatformAdminOptions {
  const options: CreatePlatformAdminOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--email' && argv[i + 1]) {
      options.email = argv[++i];
    } else if (arg === '--password' && argv[i + 1]) {
      options.password = argv[++i];
    } else if (arg === '--name' && argv[i + 1]) {
      options.name = argv[++i];
    }
  }
  return options;
}

export async function createPlatformAdmin(opts: CreatePlatformAdminOptions): Promise<{
  id: string;
  email: string;
  name: string;
  role: string;
  created: boolean;
}> {
  const email = (opts.email || process.env.ADMIN_SEED_EMAIL || '').trim().toLowerCase();
  const password = opts.password || process.env.ADMIN_SEED_PASSWORD || '';
  const name = (opts.name || process.env.ADMIN_SEED_NAME || 'Platform Administrator').trim();

  if (!email || !email.includes('@')) {
    throw new Error('Valid admin email is required (--email or ADMIN_SEED_EMAIL).');
  }

  const validation = validateAdminPassword(password);
  if (!validation.valid) {
    throw new Error(`Password requirement failed: ${validation.error}`);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let user = await UserModel.findOne({ email }).select('+passwordHash');
  let created = false;

  if (user) {
    user.role = 'PLATFORM_ADMIN';
    user.passwordHash = passwordHash;
    user.status = 'ACTIVE';
    user.name = name || user.name;
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();
    logger.info(`[PlatformAdmin] User "${email}" promoted to PLATFORM_ADMIN.`);
  } else {
    user = await UserModel.create({
      name,
      email,
      role: 'PLATFORM_ADMIN',
      passwordHash,
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockUntil: null,
      twoFactorEnabled: false
    });
    created = true;
    logger.info(`[PlatformAdmin] New PLATFORM_ADMIN created: "${email}".`);
  }

  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    created
  };
}

// Standalone runner if executed directly via node or tsx
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  try {
    await connectDatabase({ uri: config.mongodbUri, dbName: config.mongodbDbName });
    const result = await createPlatformAdmin(opts);
    logger.info(`[PlatformAdmin] Success: ${JSON.stringify(result)}`);
    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    logger.error('[PlatformAdmin] Failed to create platform admin:', err);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  }
}

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]!) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
