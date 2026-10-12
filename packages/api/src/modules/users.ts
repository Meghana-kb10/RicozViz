import type { ApiResponse, User } from '@repo/types';
import type { CreateUserRequestInput, UpdateUserRequestInput, UserQueryInput } from '@repo/validation';
import { createUserSchema } from '@repo/validation';
import type { HttpClient } from '../http';
import { createApiError } from '../http';

export class UsersClient {
  constructor(private http: HttpClient) {}

  /**
   * Fetch all users with optional query parameters (role, search, pagination, sort).
   */
  async getAll(query?: UserQueryInput): Promise<ApiResponse<User[]>> {
    return this.http.get<User[]>('/api/users', { query: query as Record<string, unknown> });
  }

  /**
   * Fetch a single user by ID.
   */
  async getById(id: string): Promise<ApiResponse<User>> {
    return this.http.get<User>(`/api/users/${id}`);
  }

  /**
   * Create a new user with client-side schema pre-validation.
   */
  async create(input: CreateUserRequestInput): Promise<ApiResponse<User>> {
    const validated = createUserSchema.safeParse(input);
    if (!validated.success) {
      const msg = validated.error.errors.map((e) => e.message).join(', ');
      return createApiError(msg, 'Validation failed');
    }

    return this.http.post<User>('/api/users', validated.data);
  }

  /**
   * Update an existing user by ID (requires authentication).
   */
  async update(id: string, input: UpdateUserRequestInput): Promise<ApiResponse<User>> {
    return this.http.put<User>(`/api/users/${id}`, input);
  }

  /**
   * Delete a user by ID (requires authentication).
   */
  async delete(id: string): Promise<ApiResponse<{ id: string; deleted: boolean }>> {
    return this.http.delete<{ id: string; deleted: boolean }>(`/api/users/${id}`);
  }
}
