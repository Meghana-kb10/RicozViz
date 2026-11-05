import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

export interface AppConfig {
  env: string;
  port: number;
  host: string;
  mongodbUri: string;
  mongodbDbName?: string;
  corsOrigin: boolean | string | string[];
  // ---- RicozViz ----
  nodeEnv: 'development' | 'test' | 'production';
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAdminSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;
  credentialEncKey: string;
  credentialEncKeyVersion: number;
  credentialEncKeysPrevious?: string;
  allowedOrigin?: string;
  webAppUrl: string;
  maxUploadSizeBytes: number;
}

/** Zod contract for the RicozViz specific environment variables. */
const ricozEnvSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters').optional(),
  JWT_ADMIN_SECRET: z.string().min(32, 'JWT_ADMIN_SECRET must be at least 32 characters').optional(),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters').optional(),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CREDENTIAL_ENC_KEY: z.string().min(32, 'CREDENTIAL_ENC_KEY must be at least 32 characters or 64 hex characters').optional(),
  CREDENTIAL_ENC_KEY_VERSION: z.coerce.number().int().positive().default(1),
  CREDENTIAL_ENC_KEYS_PREVIOUS: z.string().optional(),
  ALLOWED_ORIGIN: z.string().optional(),
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),
  MAX_UPLOAD_SIZE_BYTES: z.coerce.number().int().positive().default(15 * 1024 * 1024)
});

export function extractDatabaseName(uri: string, dbName?: string): string {
  try {
    const sanitized = uri.replace('mongodb+srv://', 'http://').replace('mongodb://', 'http://');
    const url = new URL(sanitized);
    const pathname = url.pathname.replace(/^\//, '').split('?')[0];
    if (pathname && pathname.trim().length > 0) return pathname.trim();
  } catch {
    const match = uri.match(/\/([^/?]+)(\?|$)/);
    if (match?.[1]) return match[1].trim();
  }
  if (dbName && dbName.trim().length > 0) return dbName.trim();
  return '';
}

export function assertTestDatabaseSafety(nodeEnv: string, uri: string, dbName?: string): void {
  if (nodeEnv === 'test') {
    const effectiveDbName = extractDatabaseName(uri, dbName);
    if (!effectiveDbName || !effectiveDbName.endsWith('_test')) {
      throw new Error(
        `[SECURITY ENFORCEMENT REFUSAL] Backend startup refused: NODE_ENV is "test" but database "${effectiveDbName}" does not end with "_test". Dedicated test database ending in "_test" is required.`
      );
    }
  }
}

export function loadEnv(cwd: string = process.cwd()): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.resolve(moduleDir, '..');

  // Candidate directories where .env files may reside across local dev, monorepos, and PM2 symlinked releases
  const candidateDirs = [
    process.env.ENV_DIR,
    cwd,
    packageRoot,
    path.resolve(cwd, 'shared'),
    path.resolve(cwd, 'current'),
    path.resolve(packageRoot, 'shared'),
    path.resolve(cwd, 'apps/backend')
  ].filter((dir): dir is string => typeof dir === 'string' && dir.length > 0 && fs.existsSync(dir));

  const uniqueDirs = Array.from(new Set(candidateDirs.map((dir) => path.resolve(dir))));

  // Cascade load order (earlier files override or fill in default values)
  const envFiles = [
    `.env.${nodeEnv}.local`,
    `.env.${nodeEnv}`,
    '.env.local',
    '.env'
  ];

  for (const dir of uniqueDirs) {
    for (const file of envFiles) {
      const fullPath = path.resolve(dir, file);
      if (fs.existsSync(fullPath)) {
        dotenv.config({ path: fullPath, override: false });
      }
    }
  }

  const parsed = ricozEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid RicozViz environment configuration');
  }

  const effectiveJwtAccessSecret = parsed.data.JWT_ACCESS_SECRET || parsed.data.JWT_SECRET;
  const effectiveJwtRefreshSecret = parsed.data.JWT_REFRESH_SECRET || parsed.data.JWT_SECRET;
  const effectiveCredentialKey = parsed.data.CREDENTIAL_ENC_KEY;

  if (!effectiveJwtAccessSecret || !effectiveJwtRefreshSecret || !effectiveCredentialKey) {
    const missing: string[] = [];
    if (!effectiveJwtAccessSecret) missing.push('JWT_ACCESS_SECRET (or JWT_SECRET)');
    if (!effectiveJwtRefreshSecret) missing.push('JWT_REFRESH_SECRET (or JWT_SECRET)');
    if (!effectiveCredentialKey) missing.push('CREDENTIAL_ENC_KEY');
    console.error(`\n❌ [FATAL] Missing required security environment variables: ${missing.join(', ')}.`);
    console.error(`Please configure them in your .env file or environment. Refer to .env.example for guidance.\n`);
    throw new Error(`Startup failed: Missing required environment variables: ${missing.join(', ')}`);
  }

  // Strict CORS: In production, reject wildcard '*'
  const corsOriginRaw = process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGIN || (nodeEnv === 'production' ? 'http://localhost:3000' : '*');
  let corsOrigin: boolean | string | string[];
  if (corsOriginRaw.includes(',')) {
    corsOrigin = corsOriginRaw.split(',').map((origin) => origin.trim());
  } else if (corsOriginRaw === '*') {
    if (nodeEnv === 'production') {
      console.warn('⚠️ [SECURITY WARNING] Wildcard CORS (*) is disabled in production. Defaulting to webAppUrl.');
      corsOrigin = parsed.data.WEB_APP_URL || 'http://localhost:3000';
    } else {
      corsOrigin = true;
    }
  } else {
    corsOrigin = corsOriginRaw;
  }

  const effectiveNodeEnv = (nodeEnv === 'production' || nodeEnv === 'test') ? nodeEnv : 'development';
  const mongodbUri = process.env.MONGODB_URI || (effectiveNodeEnv === 'test' ? 'mongodb://127.0.0.1:27017/ricozviz_test' : 'mongodb://127.0.0.1:27017/core_mono');
  const mongodbDbName = extractDatabaseName(mongodbUri, process.env.MONGODB_DB_NAME || process.env.DB_NAME);

  // Strict Test Database Guard: Refuse to start with NODE_ENV=test unless database name ends in _test
  assertTestDatabaseSafety(effectiveNodeEnv, mongodbUri, mongodbDbName);

  return {
    env: nodeEnv,
    nodeEnv: effectiveNodeEnv,
    port: Number(process.env.PORT) || 4000,
    host: process.env.HOST || '0.0.0.0',
    mongodbUri,
    mongodbDbName,
    corsOrigin,
    jwtAccessSecret: effectiveJwtAccessSecret,
    jwtRefreshSecret: effectiveJwtRefreshSecret,
    jwtAdminSecret: parsed.data.JWT_ADMIN_SECRET || `${effectiveJwtAccessSecret}_admin_vault_secret_32_bytes!`,
    jwtAccessExpiresIn: parsed.data.JWT_ACCESS_EXPIRES_IN,
    jwtRefreshExpiresIn: parsed.data.JWT_REFRESH_EXPIRES_IN,
    credentialEncKey: effectiveCredentialKey,
    credentialEncKeyVersion: parsed.data.CREDENTIAL_ENC_KEY_VERSION,
    credentialEncKeysPrevious: parsed.data.CREDENTIAL_ENC_KEYS_PREVIOUS,
    allowedOrigin: parsed.data.ALLOWED_ORIGIN,
    webAppUrl: parsed.data.WEB_APP_URL,
    maxUploadSizeBytes: parsed.data.MAX_UPLOAD_SIZE_BYTES
  };
}

export const config = loadEnv();