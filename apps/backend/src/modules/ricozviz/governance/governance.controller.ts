// ========================================
// Governance & Security Badges Controller
// ========================================
// Handles HTTP requests for enterprise security badges, posture, and
// cryptographic verification with sanitized responses.
// ========================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import { governanceService } from './governance.service.js';
import { getRlsPoliciesCatalog, simulateRlsEvaluation } from './rls-simulator.js';
import { AppError } from '../../../utils/errors.js';
import { logger } from '../../../utils/logger.js';
import { sendSuccess } from '../../../utils/response.js';

interface ListBadgesQuery {
  category?: string;
}

interface BadgeParams {
  id: string;
}

export async function getBadgesHandler(
  request: FastifyRequest<{ Querystring: ListBadgesQuery }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const category = request.query?.category;
    const badges = await governanceService.getSecurityBadges(category);
    return sendSuccess(reply, badges);
  } catch (error) {
    logger.error('Failed to list security badges', error);
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: error.message
      });
    }
    return reply.status(500).send({
      success: false,
      error: 'An internal error occurred while fetching security badges'
    });
  }
}

export async function getBadgeByIdHandler(
  request: FastifyRequest<{ Params: BadgeParams }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { id } = request.params;
    const badge = await governanceService.getSecurityBadgeById(id);
    return sendSuccess(reply, badge);
  } catch (error) {
    logger.error(`Failed to retrieve security badge ${request.params?.id}`, error);
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: error.message
      });
    }
    return reply.status(500).send({
      success: false,
      error: 'An internal error occurred while fetching security badge'
    });
  }
}

export async function verifyBadgeHandler(
  request: FastifyRequest<{ Params: BadgeParams }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { id } = request.params;
    const result = await governanceService.verifySecurityBadge(id);
    return sendSuccess(reply, result);
  } catch (error) {
    logger.error(`Failed to verify security badge ${request.params?.id}`, error);
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: error.message
      });
    }
    return reply.status(500).send({
      success: false,
      error: 'An internal error occurred while verifying security badge'
    });
  }
}

export async function getPostureHandler(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const posture = await governanceService.getGovernancePosture();
    return sendSuccess(reply, posture);
  } catch (error) {
    logger.error('Failed to assess governance posture', error);
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: error.message
      });
    }
    return reply.status(500).send({
      success: false,
      error: 'An internal error occurred while evaluating governance posture'
    });
  }
}

export async function getRlsPoliciesHandler(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const catalog = getRlsPoliciesCatalog();
    return sendSuccess(reply, catalog);
  } catch (error) {
    logger.error('Failed to load RLS policies catalog', error);
    return reply.status(500).send({
      success: false,
      error: 'An internal error occurred while fetching RLS policies catalog'
    });
  }
}

export async function simulateRlsHandler(
  request: FastifyRequest<{ Body: import('@repo/types').RlsSimulationRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const body = request.body ?? {
      role: 'REGIONAL_SALES_LEAD',
      activePolicyIds: ['TENANT_ISOLATION', 'REGIONAL_PARTITION', 'PII_MASKING', 'ROW_SIGNING']
    };
    const result = simulateRlsEvaluation(body);
    return sendSuccess(reply, result);
  } catch (error) {
    logger.error('Failed to simulate RLS evaluation', error);
    return reply.status(500).send({
      success: false,
      error: 'An internal error occurred while running cryptographic RLS simulation'
    });
  }
}

export async function getCisoAccreditationsHandler(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const accreditations = await governanceService.getCisoTrustOverview();
    return sendSuccess(reply, accreditations);
  } catch (error) {
    logger.error('Failed to fetch CISO accreditations', error);
    return reply.status(500).send({
      success: false,
      error: 'An internal error occurred while fetching enterprise security accreditations'
    });
  }
}

export async function getCisoAttestationPackHandler(
  request: FastifyRequest<{ Querystring: { tenantId?: string } }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const tenantId = request.query?.tenantId || 'org_enterprise_primary';
    const dossier = await governanceService.getCisoAttestationDossier(tenantId);
    return sendSuccess(reply, dossier);
  } catch (error) {
    logger.error('Failed to generate CISO attestation dossier', error);
    return reply.status(500).send({
      success: false,
      error: 'An internal error occurred while generating CISO attestation dossier'
    });
  }
}


