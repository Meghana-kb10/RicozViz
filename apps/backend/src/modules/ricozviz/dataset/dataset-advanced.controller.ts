import type { FastifyReply, FastifyRequest } from 'fastify';
import { getPrincipal } from '../../../plugins/ricozviz-auth.js';
import { AppError } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import {
  previewDatasetBlend,
  createDatasetBlend,
  listDatasetBlends,
  getDatasetBlend,
  deleteDatasetBlend,
  blendPreviewSchema,
  createBlendSchema,
  type BlendActor
} from './dataset-blend.service.js';
import { profileDataset } from './data-quality.service.js';
import {
  previewCalculatedField,
  createCalculatedField,
  listCalculatedFields,
  updateCalculatedField,
  deleteCalculatedField,
  previewCalculatedFieldSchema,
  createCalculatedFieldSchema,
  updateCalculatedFieldSchema
} from './calculated-field.service.js';
import {
  PreviewTransformationSchema,
  ApplyTransformationSchema,
  previewTransformations,
  applyTransformations
} from './transformation.service.js';
import {
  listDatasetVersions,
  getDatasetVersion,
  restoreDatasetVersion,
  getDatasetLineage
} from './versioning.service.js';
import {
  createRlsRuleSchema,
  updateRlsRuleSchema,
  resolveRlsDataset,
  listRlsRules,
  createRlsRule,
  updateRlsRule,
  deleteRlsRule
} from './rls.service.js';

interface DatasetParams {
  id: string;
}

interface CalculatedFieldParams extends DatasetParams {
  fieldId: string;
}

interface RlsParams extends DatasetParams {
  ruleId: string;
}

interface DatasetVersionParams extends DatasetParams {
  versionNumber: string;
}

interface BlendParams {
  id: string;
}

interface DatasetActor extends BlendActor {
  email: string;
  permissions: string[];
  roleId?: string;
}

function getActor(request: FastifyRequest): DatasetActor {
  const principal = getPrincipal(request);
  return {
    userId: principal.userId,
    organizationId: principal.organizationId,
    email: principal.email,
    permissions: principal.permissions,
    roleName: principal.roleName,
    roleId: principal.roleId
  };
}

function getDatasetParams(request: FastifyRequest): DatasetParams {
  return request.params as DatasetParams;
}

function parseVersionNumber(value: string): number {
  const versionNumber = Number.parseInt(value, 10);
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    throw AppError.badRequest('Invalid dataset version number');
  }
  return versionNumber;
}

export class AdvancedDatasetController {
  async profile(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const actor = getActor(request);
    const { id } = getDatasetParams(request);
    const query = request.query as { refresh?: string; force?: string };
    const result = await profileDataset(
      id,
      actor.userId,
      actor.organizationId,
      actor.roleName,
      query.refresh === 'true' || query.force === 'true'
    );
    sendSuccess(reply, result);
  }

  async previewBlend(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const result = await previewDatasetBlend(blendPreviewSchema.parse(request.body), getActor(request));
    sendSuccess(reply, result);
  }

  async createBlend(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const result = await createDatasetBlend(createBlendSchema.parse(request.body), getActor(request));
    sendSuccess(reply, result, 201);
  }

  async listBlends(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as { workspaceId?: string };
    const result = await listDatasetBlends(getActor(request), query.workspaceId);
    sendSuccess(reply, result);
  }

  async getBlend(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as BlendParams;
    sendSuccess(reply, await getDatasetBlend(id, getActor(request)));
  }

  async deleteBlend(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = request.params as BlendParams;
    sendSuccess(reply, await deleteDatasetBlend(id, getActor(request)));
  }

  async previewCalculatedField(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = getDatasetParams(request);
    const result = await previewCalculatedField(
      id,
      previewCalculatedFieldSchema.parse(request.body),
      getActor(request)
    );
    sendSuccess(reply, result);
  }

  async createCalculatedField(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = getDatasetParams(request);
    const result = await createCalculatedField(
      id,
      createCalculatedFieldSchema.parse(request.body),
      getActor(request)
    );
    sendSuccess(reply, result, 201);
  }

  async listCalculatedFields(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = getDatasetParams(request);
    sendSuccess(reply, await listCalculatedFields(id, getActor(request)));
  }

  async updateCalculatedField(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id, fieldId } = request.params as CalculatedFieldParams;
    const result = await updateCalculatedField(
      id,
      fieldId,
      updateCalculatedFieldSchema.parse(request.body),
      getActor(request)
    );
    sendSuccess(reply, result);
  }

  async deleteCalculatedField(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id, fieldId } = request.params as CalculatedFieldParams;
    sendSuccess(reply, await deleteCalculatedField(id, fieldId, getActor(request)));
  }

  async previewTransformations(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = getDatasetParams(request);
    const actor = getActor(request);
    const input = PreviewTransformationSchema.parse(request.body);
    const result = await previewTransformations(
      id,
      input.steps,
      input.limit,
      actor.userId,
      actor.organizationId,
      actor.roleName
    );
    sendSuccess(reply, result);
  }

  async applyTransformations(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = getDatasetParams(request);
    const actor = getActor(request);
    const input = ApplyTransformationSchema.parse(request.body);
    const result = await applyTransformations({
      datasetId: id,
      steps: input.steps,
      mode: input.mode,
      newDatasetName: input.newDatasetName,
      changeSummary: input.changeSummary,
      workspaceId: input.workspaceId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      userRoleName: actor.roleName
    });
    sendSuccess(reply, result, 201);
  }

  async listVersions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const actor = getActor(request);
    const { id } = getDatasetParams(request);
    sendSuccess(
      reply,
      await listDatasetVersions(id, actor.userId, actor.organizationId, actor.roleName)
    );
  }

  async getVersion(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const actor = getActor(request);
    const { id, versionNumber } = request.params as DatasetVersionParams;
    const result = await getDatasetVersion(
      id,
      parseVersionNumber(versionNumber),
      actor.userId,
      actor.organizationId,
      actor.roleName
    );
    sendSuccess(reply, result);
  }

  async restoreVersion(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const actor = getActor(request);
    const { id, versionNumber } = request.params as DatasetVersionParams;
    const result = await restoreDatasetVersion(
      id,
      parseVersionNumber(versionNumber),
      actor.userId,
      actor.organizationId,
      actor.roleName
    );
    sendSuccess(reply, result);
  }

  async lineage(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const actor = getActor(request);
    const { id } = getDatasetParams(request);
    sendSuccess(
      reply,
      await getDatasetLineage(id, actor.userId, actor.organizationId, actor.roleName)
    );
  }

  async listRlsRules(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const actor = getActor(request);
    const { id } = getDatasetParams(request);
    const dataset = await resolveRlsDataset(
      id,
      actor.userId,
      actor.organizationId,
      actor.roleName
    );
    sendSuccess(reply, await listRlsRules(dataset.id, actor.organizationId));
  }

  async createRlsRule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const actor = getActor(request);
    const { id } = getDatasetParams(request);
    const dataset = await resolveRlsDataset(
      id,
      actor.userId,
      actor.organizationId,
      actor.roleName,
      'WRITE'
    );
    const result = await createRlsRule(
      dataset,
      createRlsRuleSchema.parse(request.body),
      actor
    );
    sendSuccess(reply, result, 201);
  }

  async updateRlsRule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const actor = getActor(request);
    const { id, ruleId } = request.params as RlsParams;
    const dataset = await resolveRlsDataset(
      id,
      actor.userId,
      actor.organizationId,
      actor.roleName,
      'WRITE'
    );
    const result = await updateRlsRule(
      dataset,
      ruleId,
      updateRlsRuleSchema.parse(request.body),
      actor
    );
    sendSuccess(reply, result);
  }

  async deleteRlsRule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const actor = getActor(request);
    const { id, ruleId } = request.params as RlsParams;
    const dataset = await resolveRlsDataset(
      id,
      actor.userId,
      actor.organizationId,
      actor.roleName,
      'WRITE'
    );
    await deleteRlsRule(dataset, ruleId, actor);
    sendSuccess(reply, { message: 'RLS rule deleted successfully' });
  }
}

export const advancedDatasetController = new AdvancedDatasetController();
