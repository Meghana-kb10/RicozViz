import type { FastifyReply, FastifyRequest } from 'fastify';
import { getPrincipal } from '../../../plugins/ricozviz-auth.js';
import { AppError } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import {
  addWorkspaceMemberSchema,
  createWorkspaceSchema,
  updateWorkspaceMemberRoleSchema,
  updateWorkspaceSchema,
  createWorkspace,
  listWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  listWorkspaceMembers,
  addWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspaceMemberRole
} from './workspace.service.js';

interface WorkspaceParams {
  id: string;
}

interface WorkspaceMemberParams {
  id: string;
  userId: string;
}

/** Read `:id` from the route params, rejecting an absent identifier. */
function requireWorkspaceId(request: FastifyRequest): string {
  const { id } = request.params as WorkspaceParams;
  if (!id) {
    throw AppError.badRequest('Workspace ID is required');
  }
  return id;
}

/** Read `:userId` from the route params, rejecting an absent identifier. */
function requireTargetUserId(request: FastifyRequest): string {
  const { userId } = request.params as WorkspaceMemberParams;
  if (!userId) {
    throw AppError.badRequest('Target User ID is required');
  }
  return userId;
}

export class WorkspaceController {
  /** POST /api/v1/workspaces */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const input = createWorkspaceSchema.parse(request.body);
    const payload = await createWorkspace(principal, input);
    sendSuccess(reply, payload, 201);
  }

  /** GET /api/v1/workspaces */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const payload = await listWorkspaces(principal);
    sendSuccess(reply, payload);
  }

  /** GET /api/v1/workspaces/:id */
  async getOne(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const workspaceId = requireWorkspaceId(request);
    const payload = await getWorkspace(principal, workspaceId);
    sendSuccess(reply, payload);
  }

  /** PATCH /api/v1/workspaces/:id */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const workspaceId = requireWorkspaceId(request);
    const input = updateWorkspaceSchema.parse(request.body);
    const payload = await updateWorkspace(principal, workspaceId, input);
    sendSuccess(reply, payload);
  }

  /** DELETE /api/v1/workspaces/:id */
  async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const workspaceId = requireWorkspaceId(request);
    const payload = await deleteWorkspace(principal, workspaceId);
    sendSuccess(reply, payload);
  }

  /** GET /api/v1/workspaces/:id/members */
  async listMembers(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const workspaceId = requireWorkspaceId(request);
    const payload = await listWorkspaceMembers(principal, workspaceId);
    sendSuccess(reply, payload);
  }

  /** POST /api/v1/workspaces/:id/members */
  async addMember(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const workspaceId = requireWorkspaceId(request);
    const input = addWorkspaceMemberSchema.parse(request.body);
    const payload = await addWorkspaceMember(principal, workspaceId, input);
    sendSuccess(reply, payload, 201);
  }

  /** PATCH /api/v1/workspaces/:id/members/:userId */
  async updateMemberRole(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const workspaceId = requireWorkspaceId(request);
    const targetUserId = requireTargetUserId(request);
    const input = updateWorkspaceMemberRoleSchema.parse(request.body);
    const payload = await updateWorkspaceMemberRole(principal, workspaceId, targetUserId, input);
    sendSuccess(reply, payload);
  }

  /** DELETE /api/v1/workspaces/:id/members/:userId */
  async removeMember(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = getPrincipal(request);
    const workspaceId = requireWorkspaceId(request);
    const targetUserId = requireTargetUserId(request);
    const payload = await removeWorkspaceMember(principal, workspaceId, targetUserId);
    sendSuccess(reply, payload);
  }
}

export const workspaceController = new WorkspaceController();
