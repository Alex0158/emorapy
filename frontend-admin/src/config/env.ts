interface EnvConfig {
  apiBaseURL: string;
  frontendBaseURL?: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

export const env: EnvConfig = {
  apiBaseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1',
  frontendBaseURL: import.meta.env.VITE_FRONTEND_BASE_URL,
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
};
