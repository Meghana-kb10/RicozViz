import type { FastifyInstance } from 'fastify';
import { productController } from './product.controller.js';
import { authenticate } from '../../plugins/authenticate.js';

export async function productRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', productController.getProducts.bind(productController));
  app.get('/:id', productController.getProductById.bind(productController));
  app.post('/', { preHandler: [authenticate] }, productController.createProduct.bind(productController));
}

