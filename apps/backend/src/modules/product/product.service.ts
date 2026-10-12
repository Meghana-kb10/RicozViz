import { productRepository } from '@repo/database';
import type { CreateProductRequestInput, ProductQueryInput } from '@repo/validation';
import type { Product } from '@repo/types';

export class ProductService {
  async getAllProducts(query?: ProductQueryInput): Promise<Product[]> {
    const filter: Record<string, unknown> = {};
    if (query?.category) {
      filter.category = query.category;
    }
    if (typeof query?.inStock === 'boolean') {
      filter.inStock = query.inStock;
    }

    const options = {
      limit: query?.limit,
      skip: query?.page && query?.limit ? (query.page - 1) * query.limit : undefined,
      sort: query?.sort ? { [query.sort]: query.order === 'asc' ? (1 as const) : (-1 as const) } : undefined
    };

    return productRepository.getAllProducts(options);
  }

  async getProductById(id: string): Promise<Product | null> {
    return productRepository.getProductById(id);
  }

  async createProduct(input: CreateProductRequestInput): Promise<Product> {
    return productRepository.createProduct(input);
  }
}

export const productService = new ProductService();
