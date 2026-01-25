import type { Config } from 'jest';

/**
 * Jest 配置
 * 
 * 支持兩種測試模式：
 * - 單元測試 (unit)：快速運行，較短超時
 * - 集成測試 (integration)：完整流程測試，較長超時
 * 
 * 使用方式：
 * - npm test                    # 運行所有測試
 * - npm run test:unit           # 只運行單元測試
 * - npm run test:integration    # 只運行集成測試
 */
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/app.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // 默認超時設置（毫秒）
  // 對於集成測試，可以在測試文件中使用 jest.setTimeout() 覆蓋
  testTimeout: 30000,
  
  // 集成測試可能需要更多時間
  // 設置全局超時為 60 秒
  slowTestThreshold: 10,
  
  // 測試隔離
  // 每個測試文件在獨立的 worker 中運行
  maxWorkers: '50%',
  
  // 測試報告詳細程度
  verbose: true,
  
  // 錯誤時顯示詳細堆棧
  errorOnDeprecated: true,
  
  // 測試完成後強制退出
  forceExit: true,
  
  // 檢測未正確關閉的句柄
  detectOpenHandles: true,
  
  // 項目配置：分離單元測試和集成測試
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts', '<rootDir>/tests/integration/**/*.flow.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    },
  ],
};

export default config;

