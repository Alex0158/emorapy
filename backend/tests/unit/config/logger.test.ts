/**
 * config/logger 單元測試（覆蓋 production 時 level 為 info）
 */
import { describe, it, expect, jest } from '@jest/globals';

jest.mock('../../../src/config/env', () => ({
  get env() {
    return { NODE_ENV: 'production' };
  },
}));

import logger from '../../../src/config/logger';

describe('config/logger', () => {
  it('NODE_ENV 為 production 時 level 應為 info', () => {
    expect(logger.level).toBe('info');
  });
});
