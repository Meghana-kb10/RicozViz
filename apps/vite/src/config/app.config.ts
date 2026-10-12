export interface AppConfig {
  name: string;
  description: string;
  version: string;
  apiUrl: string;
  environment: string;
}

export const appConfig: AppConfig = {
  name: 'Ricoz Core Monorepo (Vite Client)',
  description: 'Production-ready Vite React Router v8 SPA template',
  version: '1.0.0',
  apiUrl: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:4000',
  environment: (typeof import.meta !== 'undefined' && import.meta.env?.MODE) || 'development',
};

export const APP_CONFIG = appConfig;

