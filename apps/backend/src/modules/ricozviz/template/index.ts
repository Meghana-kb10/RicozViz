export { templateRoutes } from './template.routes.js';
export { TemplateController, templateController } from './template.controller.js';
export {
  SYSTEM_TEMPLATES,
  createFromDashboardSchema,
  instantiateSchema,
  listTemplates,
  getTemplateById,
  createTemplateFromDashboard,
  instantiateDashboardFromTemplate,
  verifyResourceWorkspaceAccess,
  getDashboardWorkspaceId,
  registerInMemoryWorkspaceMember,
  clearInMemoryWorkspaceMembers
} from './template.service.js';
export type {
  SystemTemplateSeed,
  SystemTemplateItem,
  SystemTemplateDetail,
  TemplateListItem,
  TemplateDetail,
  InstantiatedDashboard,
  CreateTemplateFromDashboardParams,
  InstantiateDashboardFromTemplateParams,
  WorkspaceAction,
  WorkspaceAccessContext
} from './template.service.js';