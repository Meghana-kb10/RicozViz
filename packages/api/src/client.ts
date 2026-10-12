import { HttpClient } from './http';
import { AuthClient } from './modules/auth';
import { UsersClient } from './modules/users';
import { ProductsClient } from './modules/products';
import { HealthClient } from './modules/health';
import type { ApiClientOptions, CreateUserRequestInput, ProductQueryInput, UserQueryInput } from './types';
import type { ApiResponse, HealthStatus, Product, User } from '@repo/types';

export class ApiClient {
  public readonly http: HttpClient;
  public readonly auth: AuthClient;
  public readonly users: UsersClient;
  public readonly products: ProductsClient;
  public readonly health: HealthClient;

  constructor(options: ApiClientOptions = {}) {
    this.http = new HttpClient(options);
    this.auth = new AuthClient(this.http);
    this.users = new UsersClient(this.http);
    this.products = new ProductsClient(this.http);
    this.health = new HealthClient(this.http);
  }

  /**
   * Set or update authentication token.
   */
  public setToken(token: string | null, refreshToken?: string): void {
    this.http.setToken(token, refreshToken);
  }

  /**
   * Retrieve active authentication token.
   */
  public getToken(): Promise<string | null> {
    return this.http.getToken();
  }

  /**
   * Clear active authentication tokens.
   */
  public clearTokens(): void {
    this.http.clearTokens();
  }

  // ============================================================================
  // Backwards-compatible convenience methods
  // ============================================================================

  public getHealth(): Promise<ApiResponse<HealthStatus>> {
    return this.health.getHealth();
  }

  public getUsers(query?: UserQueryInput): Promise<ApiResponse<User[]>> {
    return this.users.getAll(query);
  }

  public createUser(input: CreateUserRequestInput): Promise<ApiResponse<User>> {
    return this.users.create(input);
  }

  public getProducts(query?: ProductQueryInput): Promise<ApiResponse<Product[]>> {
    return this.products.getAll(query);
  }
}

/**
 * Factory to create an ApiClient instance.
 */
export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  return new ApiClient(options);
}
