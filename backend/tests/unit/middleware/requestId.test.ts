/**
 * middleware/requestId 單元測試
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { requestId } from '../../../src/middleware/requestId';

const mockUuid = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';
jest.mock('uuid', () => ({
  v4: () => mockUuid,
}));

describe('middleware/requestId', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {};
    res = { setHeader: jest.fn().mockReturnThis() } as unknown as Response;
    next = jest.fn();
  });

  it('應設置 req.requestId 為 UUID', () => {
    requestId(req as Request, res as Response, next);
    expect(req.requestId).toBe(mockUuid);
  });

  it('應設置 X-Request-ID 響應頭', () => {
    requestId(req as Request, res as Response, next);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', mockUuid);
  });

  it('應調用 next()', () => {
    requestId(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
