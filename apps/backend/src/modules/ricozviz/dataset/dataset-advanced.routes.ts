import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { requireAnyPermission, requireAuth, requirePermission } from '../../../plugins/ricozviz-auth.js';
import { advancedDatasetController } from './dataset-advanced.controller.js';

export async function advancedDatasetRoutes(app: FastifyInstance): Promise<void> {
  const guard = (...permissions: preHandlerHookHandler[]): preHandlerHookHandler[] => [
    requireAuth,
    ...permissions
  ];

  app.get(
    '/:id/profile',
    { preHandler: guard(requireAnyPermission('DATASET_VIEW', 'DATASET_PROFILE')) },
    advancedDatasetController.profile.bind(advancedDatasetController)
  );

  app.post(
    '/blends/preview',
    { preHandler: guard(requirePermission('DATASET_VIEW')) },
    advancedDatasetController.previewBlend.bind(advancedDatasetController)
  );
  app.post(
    '/blends',
    { preHandler: guard(requirePermission('DATASET_CREATE')) },
    advancedDatasetController.createBlend.bind(advancedDatasetController)
  );
  app.get(
    '/blends',
    { preHandler: guard(requirePermission('DATASET_VIEW')) },
    advancedDatasetController.listBlends.bind(advancedDatasetController)
  );
  app.get(
    '/blends/:id',
    { preHandler: guard(requirePermission('DATASET_VIEW')) },
    advancedDatasetController.getBlend.bind(advancedDatasetController)
  );
  app.delete(
    '/blends/:id',
    { preHandler: guard(requirePermission('DATASET_DELETE')) },
    advancedDatasetController.deleteBlend.bind(advancedDatasetController)
  );

  app.post(
    '/:id/calculated-fields/preview',
    { preHandler: guard(requirePermission('DATASET_VIEW')) },
    advancedDatasetController.previewCalculatedField.bind(advancedDatasetController)
  );
  app.post(
    '/:id/calculated-fields',
    { preHandler: guard(requirePermission('DATASET_EDIT')) },
    advancedDatasetController.createCalculatedField.bind(advancedDatasetController)
  );
  app.get(
    '/:id/calculated-fields',
    { preHandler: guard(requirePermission('DATASET_VIEW')) },
    advancedDatasetController.listCalculatedFields.bind(advancedDatasetController)
  );
  app.patch(
    '/:id/calculated-fields/:fieldId',
    { preHandler: guard(requirePermission('DATASET_EDIT')) },
    advancedDatasetController.updateCalculatedField.bind(advancedDatasetController)
  );
  app.delete(
    '/:id/calculated-fields/:fieldId',
    { preHandler: guard(requirePermission('DATASET_EDIT')) },
    advancedDatasetController.deleteCalculatedField.bind(advancedDatasetController)
  );

  app.post(
    '/:id/transform/preview',
    { preHandler: guard(requirePermission('DATASET_VIEW')) },
    advancedDatasetController.previewTransformations.bind(advancedDatasetController)
  );
  app.post(
    '/:id/transform/apply',
    { preHandler: guard(requireAnyPermission('DATASET_EDIT', 'DATASET_TRANSFORM')) },
    advancedDatasetController.applyTransformations.bind(advancedDatasetController)
  );

  app.get(
    '/:id/versions',
    { preHandler: guard(requirePermission('DATASET_VIEW')) },
    advancedDatasetController.listVersions.bind(advancedDatasetController)
  );
  app.get(
    '/:id/versions/:versionNumber',
    { preHandler: guard(requirePermission('DATASET_VIEW')) },
    advancedDatasetController.getVersion.bind(advancedDatasetController)
  );
  app.post(
    '/:id/versions/:versionNumber/restore',
    { preHandler: guard(requireAnyPermission('DATASET_EDIT', 'DATASET_VERSION_MANAGE')) },
    advancedDatasetController.restoreVersion.bind(advancedDatasetController)
  );
  app.get(
    '/:id/lineage',
    { preHandler: guard(requirePermission('DATASET_VIEW')) },
    advancedDatasetController.lineage.bind(advancedDatasetController)
  );

  app.get(
    '/:id/rls',
    { preHandler: guard(requirePermission('DATASET_VIEW')) },
    advancedDatasetController.listRlsRules.bind(advancedDatasetController)
  );
  app.post(
    '/:id/rls',
    { preHandler: guard(requirePermission('DATASET_EDIT')) },
    advancedDatasetController.createRlsRule.bind(advancedDatasetController)
  );
  app.patch(
    '/:id/rls/:ruleId',
    { preHandler: guard(requirePermission('DATASET_EDIT')) },
    advancedDatasetController.updateRlsRule.bind(advancedDatasetController)
  );
  app.delete(
    '/:id/rls/:ruleId',
    { preHandler: guard(requirePermission('DATASET_EDIT')) },
    advancedDatasetController.deleteRlsRule.bind(advancedDatasetController)
  );
}
