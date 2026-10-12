import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import { getPrincipal } from '../../../plugins/ricozviz-auth.js';
import { parseMultipart } from '../../../plugins/multipart.js';
import { config } from '../../../config/env.js';
import type { AuthenticatedUser } from '@repo/types';
import {
  createDatasetSchema,
  updateDatasetSchema,
  listDatasetsQuerySchema,
  previewCsvSchema,
  datasetQueryParamsSchema,
  importSourceTableSchema,
  validateDatasetId,
  createDataset,
  uploadDataset,
  listDatasets,
  getDataset,
  updateDataset,
  deleteDataset,
  previewDataset,
  queryDataset,
  previewCsvSchemaHandler,
  listSourceTables,
  getSourceTableSchema,
  importSourceTable,
  type DatasetRequestContext,
  type UploadDatasetFields
} from './dataset.service.js';
import {
  listDemoCatalogSchema,
  importDemoDatasetSchema,
  getDemoCatalogList,
  getDemoDatasetById,
  importDemoDatasetRecord
} from './demo-dataset.service.js';
import {
  getDatasetRefreshSchedule,
  configureDatasetRefreshSchedule,
  deleteDatasetRefreshSchedule,
  executeDatasetRefresh
} from './dataset-refresh.service.js';

interface DatasetIdParams {
  id: string;
}

interface SourceTableParams {
  dataSourceId: string;
  tableName: string;
}

interface SourceIdParams {
  dataSourceId: string;
}

interface DemoIdParams {
  demoId: string;
}

interface PreviewQuery {
  limit?: string;
}

/** Body accepted by the refresh-schedule configuration endpoint. */
const refreshScheduleBodySchema = z
  .object({
    frequency: z.string().optional(),
    enabled: z.boolean().optional(),
    intervalMinutes: z.number().optional()
  })
  .passthrough();

export class DatasetController {
  /** POST /api/v1/datasets/upload */
  async upload(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { context } = buildContext(request);

    // Legacy accepted both `multipart/form-data` and a plain JSON body carrying
    // `fileContent` / `csvText` / `jsonText`; merge both sources, multipart wins.
    const parsed = await parseMultipart(request);
    const query = (request.query ?? {}) as { workspaceId?: string };

    const jsonBody =
      request.body && typeof request.body === 'object' && !Array.isArray(request.body)
        ? (request.body as Record<string, unknown>)
        : {};

    const pick = (key: string): string | undefined => {
      const raw = parsed.fields[key] ?? jsonBody[key];
      return typeof raw === 'string' ? raw : undefined;
    };

    const file = parsed.file
      ? {
          originalname: parsed.file.originalname,
          mimetype: parsed.file.mimetype,
          buffer: parsed.file.buffer,
          size: parsed.file.size
        }
      : undefined;

    const fields: UploadDatasetFields = {
      workspaceId: pick('workspaceId'),
      name: pick('name'),
      description: pick('description'),
      dataSourceId: pick('dataSourceId'),
      fileContent: pick('fileContent'),
      fileName: pick('fileName'),
      csvText: pick('csvText'),
      jsonText: pick('jsonText')
    };

    const result = await uploadDataset(
      { file, fields, queryWorkspaceId: query.workspaceId },
      context,
      config.maxUploadSizeBytes
    );

    sendSuccess(reply, result, 201);
  }

  /** POST /api/v1/datasets */
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { context } = buildContext(request);
    const input = createDatasetSchema.parse(request.body);

    const result = await createDataset(input, context);

    sendSuccess(reply, result, 201);
  }

  /** GET /api/v1/datasets */
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { context } = buildContext(request);
    const query = listDatasetsQuerySchema.parse(request.query ?? {});

    const { items, meta } = await listDatasets(query, context);

    sendSuccess(reply, items, 200, meta);
  }

  /** GET /api/v1/datasets/:id */
  async getOne(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { context } = buildContext(request);
    const { id } = request.params as DatasetIdParams;

    const result = await getDataset(validateDatasetId(id), context);

    sendSuccess(reply, result);
  }

  /** PATCH /api/v1/datasets/:id */
  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { context } = buildContext(request);
    const { id } = request.params as DatasetIdParams;
    const input = updateDatasetSchema.parse(request.body);

    const result = await updateDataset(validateDatasetId(id), input, context);

    sendSuccess(reply, result);
  }

  /** DELETE /api/v1/datasets/:id */
  async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { context } = buildContext(request);
    const { id } = request.params as DatasetIdParams;

    const result = await deleteDataset(validateDatasetId(id), context);

    sendSuccess(reply, result);
  }

  /** GET /api/v1/datasets/:id/preview */
  async preview(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { context } = buildContext(request);
    const { id } = request.params as DatasetIdParams;
    const { limit } = (request.query ?? {}) as PreviewQuery;

    const result = await previewDataset(validateDatasetId(id), Number(limit || 25), context);

    sendSuccess(reply, result);
  }

  /** POST /api/v1/datasets/:id/query */
  async query(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { context } = buildContext(request);
    const { id } = request.params as DatasetIdParams;
    const queryParams = datasetQueryParamsSchema.parse(request.body);

    const result = await queryDataset(validateDatasetId(id), queryParams, context);

    sendSuccess(reply, result);
  }

  /** POST /api/v1/datasets/csv/preview-schema */
  async previewCsv(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = previewCsvSchema.parse(request.body);

    const result = previewCsvSchemaHandler(input);

    sendSuccess(reply, result);
  }

  /** GET /api/v1/datasets/source/:dataSourceId/tables */
  async listSourceTables(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { context } = buildContext(request);
    const { dataSourceId } = request.params as SourceIdParams;

    const result = await listSourceTables(String(dataSourceId || ''), context);

    sendSuccess(reply, result);
  }

  /** GET /api/v1/datasets/source/:dataSourceId/tables/:tableName/schema */
  async getSourceTableSchema(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { context } = buildContext(request);
    const { dataSourceId, tableName } = request.params as SourceTableParams;

    const result = await getSourceTableSchema(
      String(dataSourceId || ''),
      String(tableName || ''),
      context
    );

    sendSuccess(reply, result);
  }

  /** POST /api/v1/datasets/source/:dataSourceId/import */
  async importSourceTable(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { context } = buildContext(request);
    const { dataSourceId } = request.params as SourceIdParams;
    const input = importSourceTableSchema.parse(request.body);

    const result = await importSourceTable(String(dataSourceId || ''), input, context);

    sendSuccess(reply, result, 201);
  }

  /** GET /api/v1/datasets/demo/catalog */
  async listDemoCatalog(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = listDemoCatalogSchema.parse(request.query ?? {});
    const catalog = getDemoCatalogList(query);

    // Legacy envelope: `total` sits next to `data`, not inside `meta`.
    reply.status(200).send({ success: true, data: catalog, total: catalog.length });
  }

  /** GET /api/v1/datasets/demo/:demoId */
  async getDemoDataset(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { demoId } = request.params as DemoIdParams;
    if (!demoId) {
      throw AppError.badRequest('Demo dataset ID is required');
    }

    const details = getDemoDatasetById(demoId);

    sendSuccess(reply, details);
  }

  /** POST /api/v1/datasets/demo/:demoId/import */
  async importDemoDataset(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { context } = buildContext(request);
    const { demoId } = request.params as DemoIdParams;
    if (!demoId) {
      throw AppError.badRequest('Demo dataset ID is required');
    }

    const body = importDemoDatasetSchema.parse(request.body ?? {});
    const requestedWsId = body.workspaceId || context.headerWorkspaceId;

    const result = await importDemoDatasetRecord(demoId, {
      organizationId: context.organizationId,
      userId: context.userId,
      roleName: context.roleName,
      workspaceId: requestedWsId,
      customName: body.customName
    });

    // Legacy envelope: `alreadyImported` and `message` are top-level siblings.
    reply.status(result.alreadyImported ? 200 : 201).send({
      success: true,
      data: {
        ...result.dataset,
        alreadyImported: result.alreadyImported
      },
      alreadyImported: result.alreadyImported,
      message: result.message
    });
  }

  /** GET /api/v1/datasets/:id/refresh-schedule */
  async getRefreshSchedule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { context } = buildContext(request);
    const { id } = request.params as DatasetIdParams;

    const result = await getDatasetRefreshSchedule(
      validateDatasetId(id),
      context.organizationId,
      context.userId,
      context.roleName
    );

    sendSuccess(reply, result);
  }

  /** POST /api/v1/datasets/:id/refresh-schedule */
  async saveRefreshSchedule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { context } = buildContext(request);
    const { id } = request.params as DatasetIdParams;
    const config_ = refreshScheduleBodySchema.parse(request.body ?? {});

    const result = await configureDatasetRefreshSchedule(
      validateDatasetId(id),
      context.organizationId,
      context.userId,
      context.roleName,
      config_
    );

    sendSuccess(reply, result);
  }

  /** DELETE /api/v1/datasets/:id/refresh-schedule */
  async removeRefreshSchedule(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { context } = buildContext(request);
    const { id } = request.params as DatasetIdParams;

    const result = await deleteDatasetRefreshSchedule(
      validateDatasetId(id),
      context.organizationId,
      context.userId,
      context.roleName
    );

    sendSuccess(reply, result);
  }

  /** POST /api/v1/datasets/:id/refresh */
  async triggerRefresh(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { context } = buildContext(request);
    const { id } = request.params as DatasetIdParams;

    const result = await executeDatasetRefresh(
      validateDatasetId(id),
      context.organizationId,
      'MANUAL',
      { userId: context.userId, roleName: context.roleName }
    );

    sendSuccess(reply, result);
  }
}

/** Build the service context from the authenticated principal + request metadata. */
function buildContext(request: FastifyRequest): { context: DatasetRequestContext } {
  const principal: AuthenticatedUser = getPrincipal(request);
  const userAgentHeader = request.headers['user-agent'];

  return {
    context: {
      organizationId: principal.organizationId,
      userId: principal.userId,
      roleName: principal.roleName,
      ipAddress: request.ip,
      userAgent: typeof userAgentHeader === 'string' ? userAgentHeader : undefined,
      headerWorkspaceId: readWorkspaceHeader(request)
    }
  };
}

/** Legacy `x-workspace-id` header support. */
function readWorkspaceHeader(request: FastifyRequest): string | undefined {
  const header = request.headers['x-workspace-id'];
  if (Array.isArray(header)) return header[0];
  return header;
}

export const datasetController = new DatasetController();