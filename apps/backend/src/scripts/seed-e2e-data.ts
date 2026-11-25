// ==============================================================================
// E2E Test Data Seeder
// ==============================================================================
// Seeds deterministic, isolated test records for E2E workflows into a test database.
// Refuses to run if database does not end in "_test".
//
// Per Phase 8.5 requirement:
// Only seeds:
// 1. Test platform admin
// 2. Test customer
// 3. Test tenant/workspace
// 4. Source-database fixtures (PostgreSQL tables: shipments & carriers)
//
// Does NOT pre-create application connectors, customer datasets, charts,
// dashboards, or public share links that the E2E workflow creates.
// ==============================================================================

import bcrypt from 'bcryptjs';
import { Client as PgClient } from 'pg';
import {
  connectDatabase,
  disconnectDatabase,
  UserModel,
  OrganizationModel,
  OrganizationMemberModel,
  WorkspaceModel,
  WorkspaceMemberModel,
  RoleModel,
  DataSourceModel,
  DatasetModel,
  ChartModel,
  DashboardModel,
  ensureSystemRolesAndPermissions
} from '@repo/database';
import { config, assertTestDatabaseSafety } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { totpService } from '../modules/admin/totp.service.js';

export const E2E_SEEDS = {
  ADMIN: {
    email: 'operator@ricozviz.internal',
    password: 'Str0ngPlatformAdmin!2026#',
    name: 'Platform Operator Lead',
    totpSecret: 'JBSWY3DPEHPK3PXP'
  },
  TENANT: {
    id: '67c7e2e00000000000000001',
    name: 'Acme Global Logistics',
    slug: 'acme-global-logistics'
  },
  CUSTOMER_USER: {
    id: '67c7e2e00000000000000002',
    email: 'lead@acmeglobal.io',
    password: 'Password123#',
    name: 'Logistics Operations Lead'
  },
  WORKSPACE: {
    id: '67c7e2e00000000000000003',
    name: 'Supply Chain Analytics'
  },
  POSTGRES: {
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT || 5432),
    database: process.env.POSTGRES_DB || 'logistics_dw',
    user: process.env.POSTGRES_USER || 'readonly_user',
    password: process.env.POSTGRES_PASSWORD || 'TestPostgresPass123!'
  }
};

/**
 * Seeds external PostgreSQL source database with genuine analytical tables.
 */
export async function seedPostgresSourceDatabase(): Promise<void> {
  const { host, port, database, user, password } = E2E_SEEDS.POSTGRES;
  logger.info(`[E2E Seeder] Connecting to external PostgreSQL source: ${host}:${port}/${database}`);

  let client: PgClient | null = null;
  try {
    client = new PgClient({ host, port, database, user, password });
    await client.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.shipments (
        shipment_id VARCHAR(50) PRIMARY KEY,
        origin_hub VARCHAR(100) NOT NULL,
        destination_hub VARCHAR(100) NOT NULL,
        transit_days NUMERIC(5, 2) NOT NULL,
        freight_charge_usd NUMERIC(10, 2) NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS public.carriers (
        carrier_id VARCHAR(50) PRIMARY KEY,
        carrier_name VARCHAR(100) NOT NULL,
        fleet_size INTEGER NOT NULL,
        rating NUMERIC(3, 2) NOT NULL
      );

      INSERT INTO public.carriers (carrier_id, carrier_name, fleet_size, rating) VALUES
      ('CARRIER_01', 'Apex Freight Global', 240, 4.8),
      ('CARRIER_02', 'TransContinental Rail & Road', 510, 4.5),
      ('CARRIER_03', 'Nordic Maritime Logistics', 120, 4.9)
      ON CONFLICT (carrier_id) DO NOTHING;

      INSERT INTO public.shipments (shipment_id, origin_hub, destination_hub, transit_days, freight_charge_usd, status) VALUES
      ('SHP-1001', 'ORD-Chicago', 'LHR-London', 2.1, 1450.00, 'DELIVERED'),
      ('SHP-1002', 'DFW-Dallas', 'FRA-Frankfurt', 1.8, 1200.50, 'IN_TRANSIT'),
      ('SHP-1003', 'HKG-Hong Kong', 'LAX-Los Angeles', 3.4, 2800.75, 'DELIVERED'),
      ('SHP-1004', 'SIN-Singapore', 'JFK-New York', 4.0, 3100.00, 'CUSTOMS_CLEARANCE'),
      ('SHP-1005', 'DXB-Dubai', 'AMS-Amsterdam', 2.6, 1850.25, 'DELIVERED')
      ON CONFLICT (shipment_id) DO NOTHING;
    `);

    logger.info('[E2E Seeder] PostgreSQL source fixtures seeded (public.shipments, public.carriers)');
  } catch (err) {
    logger.warn('[E2E Seeder] Could not seed PostgreSQL fixtures (database may be offline or configured differently):', {
      error: err instanceof Error ? err.message : String(err)
    });
  } finally {
    if (client) {
      await client.end().catch(() => {});
    }
  }
}

export async function seedE2eData(): Promise<void> {
  const dbUri = process.env.MONGODB_URI || config.mongodbUri;
  const dbName = process.env.MONGODB_DB_NAME || (dbUri.includes('/') ? undefined : config.mongodbDbName);

  // Enforce strict test database safety guard
  assertTestDatabaseSafety('test', dbUri, dbName);

  logger.info(`[E2E Seeder] Connecting to test database: ${dbUri}`);
  await connectDatabase({ uri: dbUri, dbName });

  try {
    await ensureSystemRolesAndPermissions();

    // 1. Seed / update Platform Admin with TOTP 2FA
    const adminPasswordHash = await bcrypt.hash(E2E_SEEDS.ADMIN.password, 10);
    const encryptedTotp = totpService.encryptSecret(E2E_SEEDS.ADMIN.totpSecret);
    const { hashedCodes: hashedBackupCodes } = await totpService.generateBackupCodes(10);

    await UserModel.findOneAndUpdate(
      { email: E2E_SEEDS.ADMIN.email },
      {
        email: E2E_SEEDS.ADMIN.email,
        name: E2E_SEEDS.ADMIN.name,
        passwordHash: adminPasswordHash,
        role: 'PLATFORM_ADMIN',
        status: 'ACTIVE',
        twoFactorEnabled: true,
        twoFactorSecretEncrypted: encryptedTotp.encryptedData,
        twoFactorSecretIv: encryptedTotp.iv,
        twoFactorSecretAuthTag: encryptedTotp.authTag,
        twoFactorSecretKeyVersion: encryptedTotp.keyVersion,
        twoFactorBackupCodesHashed: hashedBackupCodes,
        failedLoginAttempts: 0,
        lockUntil: null
      },
      { upsert: true, new: true }
    );
    logger.info(`[E2E Seeder] Platform admin seeded: ${E2E_SEEDS.ADMIN.email}`);

    // 2. Seed / update Tenant (Organization)
    const org = await OrganizationModel.findByIdAndUpdate(
      E2E_SEEDS.TENANT.id,
      {
        _id: E2E_SEEDS.TENANT.id,
        name: E2E_SEEDS.TENANT.name,
        slug: E2E_SEEDS.TENANT.slug,
        status: 'ACTIVE',
        plan: 'ENTERPRISE',
        settings: {
          allowedDomains: ['acmeglobal.io']
        }
      },
      { upsert: true, new: true }
    );
    logger.info(`[E2E Seeder] Organization seeded: ${E2E_SEEDS.TENANT.name}`);

    // 3. Seed / update Customer User
    const customerPasswordHash = await bcrypt.hash(E2E_SEEDS.CUSTOMER_USER.password, 10);
    const user = await UserModel.findByIdAndUpdate(
      E2E_SEEDS.CUSTOMER_USER.id,
      {
        _id: E2E_SEEDS.CUSTOMER_USER.id,
        email: E2E_SEEDS.CUSTOMER_USER.email,
        name: E2E_SEEDS.CUSTOMER_USER.name,
        passwordHash: customerPasswordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockUntil: null,
        organizationId: org._id
      },
      { upsert: true, new: true }
    );

    const adminRole = await RoleModel.findOne({ name: 'ADMIN' });

    await OrganizationMemberModel.findOneAndUpdate(
      { organizationId: org._id, userId: user._id },
      {
        organizationId: org._id,
        userId: user._id,
        roleId: adminRole?._id,
        role: 'ADMIN',
        status: 'ACTIVE'
      },
      { upsert: true }
    );
    logger.info(`[E2E Seeder] Customer user seeded: ${E2E_SEEDS.CUSTOMER_USER.email}`);

    // 4. Seed Workspace
    const workspace = await WorkspaceModel.findByIdAndUpdate(
      E2E_SEEDS.WORKSPACE.id,
      {
        _id: E2E_SEEDS.WORKSPACE.id,
        organizationId: org._id,
        name: E2E_SEEDS.WORKSPACE.name,
        isDefault: true
      },
      { upsert: true, new: true }
    );

    await WorkspaceMemberModel.findOneAndUpdate(
      { workspaceId: workspace._id, userId: user._id },
      {
        workspaceId: workspace._id,
        userId: user._id,
        roleId: adminRole?._id,
        role: 'ADMIN'
      },
      { upsert: true }
    );
    logger.info(`[E2E Seeder] Workspace seeded: ${E2E_SEEDS.WORKSPACE.name}`);

    // 5. Clean up any existing customer-created analytical entities to ensure a pristine state
    await DataSourceModel.deleteMany({ organizationId: org._id });
    await DatasetModel.deleteMany({ organizationId: org._id });
    await ChartModel.deleteMany({ organizationId: org._id });
    await DashboardModel.deleteMany({ organizationId: org._id });

    try {
      await ChartModel.collection.dropIndex('shareToken_1');
    } catch {}
    try {
      await DashboardModel.collection.dropIndex('shareToken_1');
    } catch {}
    await ChartModel.syncIndexes();
    await DashboardModel.syncIndexes();
    logger.info('[E2E Seeder] Analytical entities cleaned to ensure pure E2E generation state');

    // 6. Seed external PostgreSQL source database fixtures
    await seedPostgresSourceDatabase();

    logger.info('[E2E Seeder] Minimal E2E seeds successfully created! 🚀');
  } finally {
    await disconnectDatabase();
  }
}

// Standalone execution support
if (process.argv[1]?.includes('seed-e2e-data')) {
  seedE2eData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to seed E2E data:', err);
      process.exit(1);
    });
}
