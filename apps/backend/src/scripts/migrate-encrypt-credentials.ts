// ==============================================================================
// Migration Script: Encrypt Existing Credentials at Rest (AES-256-GCM)
// ==============================================================================
// Scans all DataSource and Alert documents in MongoDB, ensures all sensitive
// credentials (passwords, tokens, API keys, webhook URLs) are migrated into the
// encrypted CredentialVault collection, and strips plaintext secrets.
// ==============================================================================

import {
  connectDatabase,
  disconnectDatabase,
  DataSourceModel,
  AlertModel
} from '@repo/database';
import { credentialService } from '../modules/ricozviz/data-source/credential.service.js';
import { separateCredentials } from '../modules/ricozviz/data-source/data-source.service.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

export async function migrateEncryptCredentials(): Promise<{
  dataSourcesScanned: number;
  dataSourcesEncrypted: number;
  alertsScanned: number;
}> {
  logger.info('[Migration] Starting AES-256-GCM credential encryption migration...');

  let dataSourcesScanned = 0;
  let dataSourcesEncrypted = 0;
  let alertsScanned = 0;

  // 1. Migrate DataSource credentials
  const dataSources = await DataSourceModel.find({}).exec();
  dataSourcesScanned = dataSources.length;

  for (const ds of dataSources) {
    const meta = (ds.connectionMeta || {}) as unknown as Record<string, unknown>;
    const { nonSecretMeta, credentials } = separateCredentials(ds.type, meta);

    const hasPlaintextSecret = Object.keys(credentials).length > 0;
    if (hasPlaintextSecret) {
      const credentialRef = await credentialService.storeCredentials(
        ds.organizationId.toString(),
        credentials,
        ds.workspaceId ? ds.workspaceId.toString() : null
      );

      await DataSourceModel.updateOne(
        { _id: ds._id },
        {
          $set: {
            connectionMeta: nonSecretMeta,
            credentialRef
          }
        }
      ).exec();

      dataSourcesEncrypted++;
      logger.info(`[Migration] Encrypted credentials for DataSource: ${ds.name} (${ds._id})`);
    } else if (!ds.credentialRef && (meta['password'] || meta['apiKey'] || meta['bearerToken'])) {
      // Legacy unseparated metadata
      const rawCreds: Record<string, unknown> = {};
      if (meta['password']) rawCreds['password'] = meta['password'];
      if (meta['apiKey']) rawCreds['apiKey'] = meta['apiKey'];
      if (meta['bearerToken']) rawCreds['bearerToken'] = meta['bearerToken'];

      delete meta['password'];
      delete meta['apiKey'];
      delete meta['bearerToken'];

      const credentialRef = await credentialService.storeCredentials(
        ds.organizationId.toString(),
        rawCreds,
        ds.workspaceId ? ds.workspaceId.toString() : null
      );

      await DataSourceModel.updateOne(
        { _id: ds._id },
        {
          $set: {
            connectionMeta: meta,
            credentialRef
          }
        }
      ).exec();

      dataSourcesEncrypted++;
    }
  }

  // 2. Scan Alerts
  const alerts = await AlertModel.find({}).exec();
  alertsScanned = alerts.length;

  logger.info('[Migration] Credential encryption migration completed successfully', {
    dataSourcesScanned,
    dataSourcesEncrypted,
    alertsScanned
  });

  return { dataSourcesScanned, dataSourcesEncrypted, alertsScanned };
}

// Direct CLI execution support
if (process.argv[1]?.endsWith('migrate-encrypt-credentials.ts')) {
  void (async () => {
    try {
      await connectDatabase({
        uri: config.mongodbUri,
        dbName: config.mongodbDbName
      });
      await migrateEncryptCredentials();
      await disconnectDatabase();
      process.exit(0);
    } catch (err) {
      console.error('Migration failed:', err);
      process.exit(1);
    }
  })();
}
