import { getConnectionState } from '@repo/database';
import type { HealthStatus } from '@repo/types';

export class HealthService {
  getHealth(): HealthStatus {
    const dbState = getConnectionState();
    return {
      status: dbState === 'connected' ? 'ok' : 'degraded',
      service: 'backend-api',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: dbState
    };
  }
}

export const healthService = new HealthService();
