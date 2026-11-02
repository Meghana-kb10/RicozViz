import type { User, CreateUserInput, Product } from '@repo/types';
import { userRepository, UserRepository } from './repository/user.repository';
import { productRepository, ProductRepository } from './repository/product.repository';
import { COLLECTIONS, RICOZVIZ_COLLECTIONS } from './collections/collections';
import { BaseRepository } from './repository/base.repository';
import {
  connectDatabase,
  disconnectDatabase,
  getConnectionState,
  seedInitialData,
  type DatabaseConfig
} from './connection';

// ---- Collections ----
export { COLLECTIONS, RICOZVIZ_COLLECTIONS };
export type { CollectionName } from './collections/collections';

// ---- Repositories ----
export { BaseRepository };
export type { QueryPaginationOptions } from './repository/base.repository';
export { userRepository, UserRepository } from './repository/user.repository';
export { productRepository, ProductRepository } from './repository/product.repository';

// ---- Template models ----
export { UserModel } from './models/user.model';
export type { IUserDocument } from './models/user.model';
export { SessionModel } from './models/session.model';
export type { ISessionDocument } from './models/session.model';
export { ProductModel } from './models/product.model';
export type { IProductDocument } from './models/product.model';

// ---- RicozViz models ----
export { OrganizationModel, RoleModel, PermissionModel, RolePermissionModel, OrganizationMemberModel } from './models/organization.model';
export type {
  IOrganizationDocument,
  IRoleDocument,
  IPermissionDocument,
  IRolePermissionDocument,
  IOrganizationMemberDocument
} from './models/organization.model';
export { WorkspaceModel, WorkspaceMemberModel } from './models/workspace.model';
export type { IWorkspaceDocument, IWorkspaceMemberDocument } from './models/workspace.model';
export { DataSourceModel } from './models/data-source.model';
export type { IDataSourceDocument } from './models/data-source.model';
export { DatasetModel, DatasetColumnModel, RowLevelSecurityRuleModel } from './models/dataset.model';
export type {
  IDatasetDocument,
  IDatasetColumnDocument,
  IRowLevelSecurityRuleDocument
} from './models/dataset.model';
export { DatasetVersionModel } from './models/dataset-version.model';
export type { IDatasetVersionDocument } from './models/dataset-version.model';
export { DashboardModel, DashboardVersionModel, DashboardAccessModel } from './models/dashboard.model';
export type {
  IDashboardDocument,
  IDashboardVersionDocument,
  IDashboardAccessDocument
} from './models/dashboard.model';
export { ChartModel } from './models/chart.model';
export type { IChartDocument } from './models/chart.model';
export { MetricModel, AlertModel, AlertHistoryModel } from './models/metric.model';
export type { IMetricDocument, IAlertDocument, IAlertHistoryDocument } from './models/metric.model';
export { CredentialVaultModel } from './models/credential-vault.model';
export type { ICredentialVaultDocument } from './models/credential-vault.model';
export { RefreshTokenModel } from './models/refresh-token.model';
export type { IRefreshTokenDocument } from './models/refresh-token.model';
export {
  ReportModel,
  ReportExecutionModel,
  ExportJobModel,
  DashboardTemplateModel,
  AuditLogModel
} from './models/insight.model';
export { AiUsageModel } from './models/ai-usage.model';
export type {
  IReportDocument,
  IReportExecutionDocument,
  IExportJobDocument,
  IDashboardTemplateDocument,
  IAuditLogDocument
} from './models/insight.model';
export type { IAiUsage, IAiUsageDocument, AiUsageStatus } from './models/ai-usage.model';

// ---- Model helpers ----
export { defineModel, objectIdRef, objectIdRefOptional, toObjectId, idToString } from './models/model.util';
export { buildTenantFilter, assertTenantAccess, type TenantContext } from './tenant';

// ---- Serializers ----
export { serializeUser, serializeUsers } from './serializers/user.serializer';
export { serializeProduct, serializeProducts } from './serializers/product.serializer';
export { serialize, serializeDoc, serializeDocs, serializePaginated } from './serializers/ricozviz.serializer';

// ---- Connection & seed ----
export {
  connectDatabase,
  disconnectDatabase,
  getConnectionState,
  seedInitialData
} from './connection';
export type { DatabaseConfig } from './connection';
export {
  ensureSystemRolesAndPermissions,
  getPermissionsForRole,
  SYSTEM_ROLE_NAMES,
  PERMISSION_KEYS
} from './seed/ricozviz.seed';
export { dbLogger } from './logger';

const isDatabaseConnected = (): boolean => getConnectionState() === 'connected';
type DatabaseConnectionOptions = DatabaseConfig;

// Unified db facade for convenience and backward compatibility
export const db = {
  getUsers: (): Promise<User[]> => userRepository.getAllUsers(),
  getUserById: (id: string): Promise<User | null> => userRepository.getUserById(id),
  createUser: (input: CreateUserInput & { password?: string }): Promise<User> =>
    userRepository.createUser(input),
  getProducts: (): Promise<Product[]> => productRepository.getAllProducts(),
  getProductById: (id: string): Promise<Product | null> => productRepository.getProductById(id)
};