export interface AppConfig {
  name: string;
  description: string;
  version: string;
  apiUrl: string;
  environment: string;
}

export const appConfig: AppConfig = {
  name: 'Ricoz Core Monorepo (Next.js)',
  description: 'Production-ready Next.js 15 enterprise frontend template',
  version: '1.0.0',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  environment: process.env.NODE_ENV || 'development',
};

export const APP_CONFIG = appConfig;
