export { collaborationRoutes } from './collaboration.routes.js';
export { CollaborationController, collaborationController } from './collaboration.controller.js';
export {
  GrantAccessSchema,
  UpdateAccessSchema,
  listDashboardCollaborators,
  grantDashboardCollaborator,
  revokeDashboardCollaborator,
  createChartShareLink,
  revokeChartShareLink,
  getSharedChartByToken,
  getSharedChartDataByToken
} from './collaboration.service.js';
export type { CollaboratorInfo, ChartShareLinkResult } from './collaboration.service.js';
export {
  registerInMemoryDashboard,
  clearInMemoryDashboards,
  broadcastDashboardEvent,
  getDashboardActiveCollaborators,
  clearCollaborationState,
  resolveUserFromTokenSource,
  openCollaborationStream,
  handlePresenceHeartbeat,
  handleCollaborativeUpdate,
  handleGetCollaborationState,
  collaborativeUpdateSchema,
  resolveCollaborationDashboard,
  handleCreateDashboardWsTicket
} from './realtime-collaboration.service.js';
export type {
  SseSink,
  CollaboratorPresenceRecord,
  CollaborativeUpdateResult
} from './realtime-collaboration.service.js';

export {
  createWsTicket,
  consumeWsTicket,
  clearInMemoryTickets
} from './ws-ticket.service.js';

export {
  handleWsConnection,
  broadcastWsDashboardUpdate,
  getRoomCollaboratorsCount,
  clearAllWsRooms
} from './ws-collaboration.service.js';
