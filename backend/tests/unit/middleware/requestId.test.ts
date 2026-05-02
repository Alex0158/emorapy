/**
 * middleware/requestId 單元測試
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { requestId } from '../../../src/middleware/requestId';

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
    expect(req.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('應設置 X-Request-ID 響應頭', () => {
    requestId(req as Request, res as Response, next);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.requestId);
  });

  it('應調用 next()', () => {
    requestId(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
