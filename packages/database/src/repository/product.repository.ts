import type { Product } from '@repo/types';
import { BaseRepository, type QueryPaginationOptions } from './base.repository';
import { ProductModel, type IProductDocument } from '../models/product.model';
import { serializeProduct, serializeProducts } from '../serializers/product.serializer';

export interface CreateProductInput {
  title: string;
  description: string;
  price: number;
  category: string;
  inStock?: boolean;
}

export class ProductRepository extends BaseRepository<IProductDocument> {
  constructor() {
    super(ProductModel);
  }

  async getAllProducts(options?: QueryPaginationOptions): Promise<Product[]> {
    const docs = await this.find({}, options);
    return serializeProducts(docs);
  }

  async getProductById(id: string): Promise<Product | null> {
    const doc = await this.findById(id);
    return doc ? serializeProduct(doc) : null;
  }

  async createProduct(input: CreateProductInput): Promise<Product> {
    const doc = await this.create({
      title: input.title.trim(),
      description: input.description.trim(),
      price: input.price,
      category: input.category.trim(),
      inStock: input.inStock ?? true
    } as any);
    return serializeProduct(doc);
  }

  async updateProduct(id: string, input: Partial<CreateProductInput>): Promise<Product | null> {
    const updated = await this.update(id, input as any);
    return updated ? serializeProduct(updated) : null;
  }

  async deleteProduct(id: string): Promise<boolean> {
    return this.delete(id);
  }
}

export const productRepository = new ProductRepository();
