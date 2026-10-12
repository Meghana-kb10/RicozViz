import type { ApiResponse, Product } from '@repo/types';
import type { CreateProductRequestInput, ProductQueryInput } from '@repo/validation';
import { createProductRequestSchema } from '@repo/validation';
import type { HttpClient } from '../http';
import { createApiError } from '../http';

export class ProductsClient {
  constructor(private http: HttpClient) {}

  /**
   * Fetch all products with optional filters (category, search, pagination, sort).
   */
  async getAll(query?: ProductQueryInput): Promise<ApiResponse<Product[]>> {
    return this.http.get<Product[]>('/api/products', { query: query as Record<string, unknown> });
  }

  /**
   * Fetch a single product by ID.
   */
  async getById(id: string): Promise<ApiResponse<Product>> {
    return this.http.get<Product>(`/api/products/${id}`);
  }

  /**
   * Create a new product (requires authentication).
   */
  async create(input: CreateProductRequestInput): Promise<ApiResponse<Product>> {
    const validated = createProductRequestSchema.safeParse(input);
    if (!validated.success) {
      const msg = validated.error.errors.map((e) => e.message).join(', ');
      return createApiError(msg, 'Validation failed');
    }

    return this.http.post<Product>('/api/products', validated.data);
  }
}
