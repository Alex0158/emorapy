/**
 * 環境變量配置
 */

interface EnvConfig {
  apiBaseURL: string;
  appTitle: string;
  appDescription: string;
  isDevelopment: boolean;
  isProduction: boolean;
  gaTrackingId?: string;
  sentryDSN?: string;
}

// 環境變量驗證（僅在瀏覽器運行時執行，不在構建時執行）
function validateEnvConfig(): void {
  // 構建時或 SSR 環境跳過驗證
  if (typeof window === 'undefined') {
    return;
  }

  const isProduction = import.meta.env.PROD;
  const isDevelopment = import.meta.env.DEV;

  // 驗證 API Base URL
  const apiBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
  
  if (isProduction) {
    // 生產環境必須配置 API URL
    if (!import.meta.env.VITE_API_BASE_URL) {
      const error = new Error('生產環境缺少必需的環境變量: VITE_API_BASE_URL');
      // 生產環境驗證失敗必須拋出錯誤，但不在控制台輸出（避免洩露信息）
      throw error;
    }
    
    // 生產環境 API URL 應使用 HTTPS（僅在開發環境輸出警告）
    if (apiBaseURL.startsWith('http://') && !apiBaseURL.includes('localhost')) {
      // 生產環境不輸出警告到控制台，應通過日誌服務記錄
      // 這裡不輸出，因為生產環境不應有 console 輸出
    }
  }

  if (isDevelopment) {
    // 開發環境檢查是否配置了生產環境的 URL
    if (apiBaseURL.includes('https://') && !apiBaseURL.includes('localhost')) {
      console.warn('警告: 開發環境檢測到生產環境 API URL，請確認配置正確');
    }
  }
}

// 執行驗證（僅在瀏覽器環境）
if (typeof window !== 'undefined') {
  try {
    validateEnvConfig();
  } catch (error) {
    // 在開發環境顯示詳細錯誤
    if (import.meta.env.DEV) {
      console.error('環境變量驗證失敗:', error);
    }
    // 生產環境直接拋出錯誤（不輸出到控制台）
    if (import.meta.env.PROD) {
      throw error;
    }
  }
}

export const env: EnvConfig = {
  apiBaseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1',
  appTitle: import.meta.env.VITE_APP_TITLE || '熊媽媽法庭',
  appDescription: import.meta.env.VITE_APP_DESCRIPTION || '大愛、包容、保護、呵護，為您的關係提供公正溫暖的判決。',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  gaTrackingId: import.meta.env.VITE_GA_TRACKING_ID,
  sentryDSN: import.meta.env.VITE_SENTRY_DSN,
};

