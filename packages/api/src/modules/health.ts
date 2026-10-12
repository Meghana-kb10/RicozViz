import type { ApiResponse, HealthStatus } from '@repo/types';
import type { HttpClient } from '../http';

export class HealthClient {
  constructor(private http: HttpClient) {}

  /**
   * Fetch backend system health status.
   */
  async getHealth(): Promise<ApiResponse<HealthStatus>> {
    return this.http.get<HealthStatus>('/api/health');
  }
}
