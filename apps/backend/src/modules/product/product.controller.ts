import type { FastifyReply, FastifyRequest } from 'fastify';
import { createApiResponse, createApiError } from '@repo/api';
import { logger } from '@repo/utils';
import {
  validate,
  createProductRequestSchema,
  productParamsSchema,
  productQuerySchema
} from '@repo/validation';
import { productService } from './product.service.js';

export class ProductController {
  async getProducts(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = validate(productQuerySchema, request.query);
      const products = await productService.getAllProducts(query);
      reply.status(200).send(createApiResponse(products));
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Failed to fetch products';
      logger.error(`[Product] Failed to fetch products: ${message}`, error);
      reply.status(500).send(createApiError(message));
    }
  }

  async getProductById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { id } = validate(productParamsSchema, request.params);
      const product = await productService.getProductById(id);
      if (!product) {
        logger.warn(`[Product] Product with ID ${id} not found`);
        reply.status(404).send(createApiError(`Product with ID ${id} not found`));
        return;
      }
      reply.status(200).send(createApiResponse(product));
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Failed to fetch product';
      logger.error(`[Product] Failed to fetch product: ${message}`, error);
      reply.status(400).send(createApiError(message));
    }
  }

  async createProduct(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = validate(createProductRequestSchema, request.body);
      const product = await productService.createProduct(input);
      reply.status(201).send(createApiResponse(product, 'Product created successfully'));
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Failed to create product';
      logger.error(`[Product] Failed to create product: ${message}`, error);
      reply.status(400).send(createApiError(message));
    }
  }
}

export const productController = new ProductController();
