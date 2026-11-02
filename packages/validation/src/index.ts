// Validate utilities
export {
  ValidationError,
  validate,
  validateAsync,
  safeValidate,
  formatZodError,
  formatZodFieldErrors
} from './validate';

// Common schemas and types
export {
  paginationQuerySchema,
  paginationMetaSchema,
  idParamSchema,
  mongoIdSchema,
  mongoIdParamSchema,
  baseResponseSchema,
  createApiResponseSchema,
  apiErrorResponseSchema,
  type PaginationQueryInput,
  type PaginationMeta,
  type IdParamInput,
  type MongoIdParamInput
} from './common/index';

// Auth schemas and types
export {
  authRoleSchema,
  authTokensSchema,
  authUserSchema,
  loginRequestSchema,
  registerRequestSchema,
  refreshTokenRequestSchema,
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
  authResponseSchema,
  tokenResponseSchema,
  authProfileResponseSchema,
  authVerifyQuerySchema,
  authRedirectQuerySchema,
  authResetTokenParamSchema,
  type AuthRole,
  type AuthTokens,
  type AuthUser,
  type LoginRequestInput,
  type RegisterRequestInput,
  type RefreshTokenRequestInput,
  type ForgotPasswordRequestInput,
  type ResetPasswordRequestInput,
  type AuthResponse,
  type TokenResponse,
  type AuthProfileResponse,
  type AuthVerifyQueryInput,
  type AuthRedirectQueryInput,
  type AuthResetTokenParamInput
} from './auth/index';

// User schemas and types
export {
  userRoleSchema,
  userSchema,
  createUserRequestSchema,
  updateUserRequestSchema,
  changePasswordRequestSchema,
  createUserSchema,
  updateUserSchema,
  userResponseSchema,
  userListResponseSchema,
  userQuerySchema,
  userParamsSchema,
  type UserRole,
  type UserSchemaType,
  type CreateUserRequestInput,
  type UpdateUserRequestInput,
  type ChangePasswordRequestInput,
  type CreateUserInputType,
  type UpdateUserInputType,
  type UserResponse,
  type UserListResponse,
  type UserQueryInput,
  type UserParamsInput
} from './user/index';

// Product schemas and types
export {
  productSchema,
  createProductRequestSchema,
  updateProductRequestSchema,
  productResponseSchema,
  productListResponseSchema,
  productQuerySchema,
  productParamsSchema,
  type ProductSchemaType,
  type ProductInputType,
  type CreateProductRequestInput,
  type UpdateProductRequestInput,
  type ProductResponse,
  type ProductListResponse,
  type ProductQueryInput,
  type ProductParamsInput
} from './product/index';

// Backward compatibility aliases
export { loginRequestSchema as loginSchema } from './auth/index';
export type { LoginRequestInput as LoginInputType } from './auth/index';

// RicozViz enterprise validation schemas
// RicozViz enterprise validation schemas
export {
  resourceIdParamSchema,
  resourceTokenParamSchema,
  resourceSlugParamSchema,
  aiFilterSchema,
  askAnalystSchema,
  nlToChartSchema,
  insightsSchema,
  dashboardSummarySchema,
  testRawConnectionSchema,
  createDataSourceSchema,
  updateDataSourceSchema,
  createDatasetSchema,
  updateDatasetSchema,
  listDatasetsQuerySchema,
  datasetQueryParamsSchema,
  createDashboardSchema,
  updateDashboardSchema,
  listDashboardsQuerySchema,
  createEmbedConfigSchema,
  createChartSchema,
  updateChartSchema,
  createAlertSchema,
  updateAlertSchema,
  exportRequestSchema,
  createWorkspaceSchema,
  updateWorkspaceSchema
} from './ricozviz/index';

