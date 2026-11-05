// ==============================================================================
// E2E Test Data Cleaner
// ==============================================================================
// Safely removes seeded test records from the dedicated test database.
// Refuses to run if database does not end in "_test".
// ==============================================================================

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
  AuditLogModel
} from '@repo/database';
import { config, assertTestDatabaseSafety } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { E2E_SEEDS } from './seed-e2e-data.js';

export async function cleanE2eData(): Promise<void> {
  const dbUri = process.env.MONGODB_URI || config.mongodbUri;
  const dbName = process.env.MONGODB_DB_NAME || config.mongodbDbName;

  assertTestDatabaseSafety('test', dbUri, dbName);

  logger.info(`[E2E Cleaner] Connecting to test database: ${dbUri}`);
  await connectDatabase({ uri: dbUri, dbName });

  try {
    await UserModel.deleteMany({
      email: { $in: [E2E_SEEDS.ADMIN.email, E2E_SEEDS.CUSTOMER_USER.email] }
    });

    await OrganizationModel.deleteMany({
      _id: { $in: [E2E_SEEDS.TENANT.id] }
    });

    await OrganizationMemberModel.deleteMany({
      organizationId: E2E_SEEDS.TENANT.id
    });

    await WorkspaceModel.deleteMany({
      _id: { $in: [E2E_SEEDS.WORKSPACE.id] }
    });

    await WorkspaceMemberModel.deleteMany({
      workspaceId: E2E_SEEDS.WORKSPACE.id
    });

    await DataSourceModel.deleteMany({
      _id: { $in: [E2E_SEEDS.DATA_SOURCE_PG.id, E2E_SEEDS.DATA_SOURCE_CSV.id] }
    });

    await DatasetModel.deleteMany({
      _id: { $in: [E2E_SEEDS.DATASET.id] }
    });

    await ChartModel.deleteMany({
      title: 'Transit Duration by Carrier'
    });

    await DashboardModel.deleteMany({
      _id: { $in: [E2E_SEEDS.DASHBOARD.id] }
    });

    await AuditLogModel.deleteMany({
      resourceId: E2E_SEEDS.TENANT.id
    });

    logger.info('[E2E Cleaner] Test data cleaned successfully! 🧹');
  } finally {
    await disconnectDatabase();
  }
}

if (process.argv[1]?.includes('clean-e2e-data')) {
  cleanE2eData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to clean E2E data:', err);
      process.exit(1);
    });
}
