// ==============================================================================
// E2E Test Data Seeder
// ==============================================================================
// Seeds deterministic, isolated test records for E2E workflows into a test database.
// Refuses to run if database does not end in "_test".
// ==============================================================================

import bcrypt from 'bcryptjs';
import {
  connectDatabase,
  disconnectDatabase,
  UserModel,
  OrganizationModel,
  OrganizationMemberModel,
  WorkspaceModel,
  WorkspaceMemberModel,
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
  DATA_SOURCE_PG: {
    id: '67c7e2e00000000000000004',
    name: 'Warehouse Operations PostgreSQL',
    type: 'POSTGRESQL'
  },
  DATA_SOURCE_CSV: {
    id: '67c7e2e00000000000000005',
    name: 'Global Shipments CSV',
    type: 'CSV'
  },
  DATASET: {
    id: '67c7e2e00000000000000006',
    name: 'Q4 Freight Logistics & Transit Times'
  },
  DASHBOARD: {
    id: '67c7e2e00000000000000007',
    title: 'Executive Supply Chain Command'
  }
};

export async function seedE2eData(): Promise<void> {
  const dbUri = process.env.MONGODB_URI || config.mongodbUri;
  const dbName = process.env.MONGODB_DB_NAME || config.mongodbDbName;

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
        organizationId: org._id
      },
      { upsert: true, new: true }
    );

    await OrganizationMemberModel.findOneAndUpdate(
      { organizationId: org._id, userId: user._id },
      {
        organizationId: org._id,
        userId: user._id,
        role: 'ADMIN'
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
        role: 'ADMIN'
      },
      { upsert: true }
    );

    // 5. Seed Data Sources
    await DataSourceModel.findByIdAndUpdate(
      E2E_SEEDS.DATA_SOURCE_PG.id,
      {
        _id: E2E_SEEDS.DATA_SOURCE_PG.id,
        organizationId: org._id,
        workspaceId: workspace._id,
        name: E2E_SEEDS.DATA_SOURCE_PG.name,
        type: E2E_SEEDS.DATA_SOURCE_PG.type,
        config: {
          host: '127.0.0.1',
          port: 5432,
          database: 'logistics_dw',
          username: 'pg_readonly'
        },
        status: 'CONNECTED'
      },
      { upsert: true }
    );

    await DataSourceModel.findByIdAndUpdate(
      E2E_SEEDS.DATA_SOURCE_CSV.id,
      {
        _id: E2E_SEEDS.DATA_SOURCE_CSV.id,
        organizationId: org._id,
        workspaceId: workspace._id,
        name: E2E_SEEDS.DATA_SOURCE_CSV.name,
        type: E2E_SEEDS.DATA_SOURCE_CSV.type,
        config: {
          fileName: 'global_shipments_q4.csv',
          delimiter: ','
        },
        status: 'CONNECTED'
      },
      { upsert: true }
    );

    // 6. Seed Dataset
    const dataset = await DatasetModel.findByIdAndUpdate(
      E2E_SEEDS.DATASET.id,
      {
        _id: E2E_SEEDS.DATASET.id,
        organizationId: org._id,
        workspaceId: workspace._id,
        dataSourceId: E2E_SEEDS.DATA_SOURCE_PG.id,
        name: E2E_SEEDS.DATASET.name,
        columns: [
          { name: 'shipment_id', type: 'STRING', isNullable: false },
          { name: 'origin_hub', type: 'STRING', isNullable: false },
          { name: 'destination_hub', type: 'STRING', isNullable: false },
          { name: 'transit_days', type: 'NUMBER', isNullable: false },
          { name: 'freight_charge_usd', type: 'NUMBER', isNullable: false },
          { name: 'status', type: 'STRING', isNullable: false }
        ],
        rowCount: 1250,
        status: 'READY'
      },
      { upsert: true, new: true }
    );

    // 7. Seed Chart & Dashboard
    const chart = await ChartModel.findOneAndUpdate(
      { organizationId: org._id, title: 'Transit Duration by Carrier' },
      {
        organizationId: org._id,
        workspaceId: workspace._id,
        datasetId: dataset._id,
        title: 'Transit Duration by Carrier',
        type: 'BAR',
        config: {
          xAxis: 'origin_hub',
          yAxis: 'transit_days',
          aggregation: 'AVG'
        }
      },
      { upsert: true, new: true }
    );

    await DashboardModel.findByIdAndUpdate(
      E2E_SEEDS.DASHBOARD.id,
      {
        _id: E2E_SEEDS.DASHBOARD.id,
        organizationId: org._id,
        workspaceId: workspace._id,
        title: E2E_SEEDS.DASHBOARD.title,
        charts: [chart._id],
        visibility: 'WORKSPACE',
        shareLink: {
          token: 'sh_e2e_valid_token_sample',
          enabled: true,
          expiresAt: new Date(Date.now() + 30 * 86400000)
        }
      },
      { upsert: true }
    );

    logger.info('[E2E Seeder] Complete E2E seed dataset successfully populated! 🚀');
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
