export { authRoutes } from './auth.routes.js';
export { AuthController, authController } from './auth.controller.js';
export {
  registerSchema,
  loginSchema,
  register,
  login,
  me,
  refresh,
  logout,
  buildSafeUser,
  getMembership,
  getPermissionsForRoleId,
  issueTokens,
  refreshCookieOptions,
  REFRESH_TOKEN_COOKIE
} from './auth.service.js';
export type {
  RegisterInput,
  LoginInput,
  RegisterResult,
  IssuedTokens,
  SessionResult
} from './auth.service.js';