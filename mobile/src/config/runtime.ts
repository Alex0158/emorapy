import Constants from 'expo-constants';

export interface RuntimeConfig {
  apiBaseUrl: string;
  locale: string;
  appVersion: string;
  buildNumber: string;
  requestTimeoutMs: number;
  sentryDsn?: string;
  sentryEnvironment: string;
}

function readExpoExtra(key: string): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const value = extra?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readEnv(key: string): string | undefined {
  const maybeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  const value = maybeProcess?.env?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function getRuntimeConfig(): RuntimeConfig {
  const expoConfig = Constants.expoConfig;
  const androidVersionCode = expoConfig?.android?.versionCode;

  return {
    apiBaseUrl:
      readEnv('EXPO_PUBLIC_API_BASE_URL') ??
      readExpoExtra('apiBaseUrl') ??
      'http://127.0.0.1:3001/api/v1',
    locale: readEnv('EXPO_PUBLIC_LOCALE') ?? readExpoExtra('locale') ?? 'zh-TW',
    appVersion: expoConfig?.version ?? '0.0.0',
    buildNumber:
      readEnv('EXPO_PUBLIC_BUILD_NUMBER') ??
      expoConfig?.ios?.buildNumber ??
      (typeof androidVersionCode === 'number' ? String(androidVersionCode) : undefined) ??
      'dev',
    requestTimeoutMs: Number(readEnv('EXPO_PUBLIC_REQUEST_TIMEOUT_MS') ?? 30000),
    sentryDsn: readEnv('EXPO_PUBLIC_SENTRY_DSN') ?? readExpoExtra('sentryDsn'),
    sentryEnvironment:
      readEnv('EXPO_PUBLIC_SENTRY_ENVIRONMENT') ??
      readEnv('APP_ENV') ??
      readExpoExtra('sentryEnvironment') ??
      'development',
  };
}
