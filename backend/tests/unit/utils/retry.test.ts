import { retryWithBackoff, retry } from '../../../src/utils/retry';

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() })),
  },
}));

describe('utils/retry', () => {
  describe('retry', () => {
    test('succeeds after transient failures', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('transient');
        return 'ok';
      };
      const result = await retry(fn, 5, 1);
      expect(result).toBe('ok');
      expect(attempts).toBe(3);
    });

    test('succeeds on first attempt', async () => {
      const fn = async () => 'immediate';
      expect(await retry(fn, 3, 100)).toBe('immediate');
    });

    test('throws after max retries exhausted', async () => {
      const fn = async () => {
        throw new Error('persistent');
      };
      await expect(retry(fn, 2, 1)).rejects.toThrow('persistent');
    });

    test('maxRetries 為 0 時應立即拋出，不呼叫 fn', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('x'));
      await expect(retry(fn, 0, 100)).rejects.toThrow('Unknown error');
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('retryWithBackoff', () => {
    test('stops on non-retriable 4xx-like error', async () => {
      const fn = async () => {
        const err: any = new Error('bad request');
        err.status = 400;
        throw err;
      };
      await expect(
        retryWithBackoff(fn, {
          maxRetries: 3,
          initialDelay: 1,
          maxDelay: 2,
          backoffMultiplier: 2,
        })
      ).rejects.toThrow('bad request');
    });

    test('401/403/404 應不重試（4xx 不重試）', async () => {
      const fn = jest.fn().mockRejectedValue((() => {
        const err: any = new Error('auth');
        err.status = 401;
        return err;
      })());
      await expect(retryWithBackoff(fn, { maxRetries: 3, initialDelay: 1 })).rejects.toThrow('auth');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('error 無 status 時應重試', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 2) throw new Error('network');
        return 'ok';
      };
      const result = await retryWithBackoff(fn, { maxRetries: 3, initialDelay: 1 });
      expect(result).toBe('ok');
      expect(attempts).toBe(2);
    });

    test('retries on 5xx and succeeds', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 2) {
          const err: any = new Error('server error');
          err.status = 500;
          throw err;
        }
        return 'ok';
      };
      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 1,
        maxDelay: 10,
      });
      expect(result).toBe('ok');
      expect(attempts).toBe(2);
    });

    test('respects custom shouldRetry', async () => {
      const fn = async () => {
        throw new Error('custom');
      };
      await expect(
        retryWithBackoff(fn, {
          maxRetries: 2,
          initialDelay: 1,
          shouldRetry: () => false,
        })
      ).rejects.toThrow('custom');
    });
  });
});
