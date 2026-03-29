/**
 * middleware/responseFormatter 單元測試
 */
import { describe, it, expect, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { responseFormatter } from '../../../src/middleware/responseFormatter';

function createMockReq(overrides: Partial<Request> = {}): Request {
  return { requestId: 'req-123', ...overrides } as Request;
}

function createMockRes(): { res: Response; jsonMock: jest.Mock } {
  const jsonMock = jest.fn().mockReturnThis();
  const res = { json: jsonMock } as unknown as Response;
  return { res, jsonMock };
}

describe('middleware/responseFormatter', () => {
  it('應在無 requestId 時使用空字串', () => {
    const req = createMockReq({ requestId: undefined });
    const { res, jsonMock } = createMockRes();
    const next = jest.fn();
    responseFormatter(req, res, next);
    res.json({ success: true, data: {} });
    expect(next).toHaveBeenCalled();
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        meta: expect.objectContaining({ request_id: '' }),
      })
    );
  });

  it('應為已有 success 的響應添加 meta', () => {
    const req = createMockReq();
    const { res, jsonMock } = createMockRes();
    const next = jest.fn();
    responseFormatter(req, res, next);
    const payload = { success: true, data: { id: 1 } };
    res.json(payload);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        meta: expect.objectContaining({
          request_id: 'req-123',
          timestamp: expect.any(String),
        }),
      })
    );
  });

  it('應將 data.status 透出到頂層當響應無 status', () => {
    const req = createMockReq();
    const { res, jsonMock } = createMockRes();
    const next = jest.fn();
    responseFormatter(req, res, next);
    const payload = {
      success: true,
      data: { status: 'ok', id: 1 },
    };
    res.json(payload);
    const callArg = jsonMock.mock.calls[0][0] as { status: string; data: object };
    expect(callArg.status).toBe('ok');
    expect(callArg.data).toEqual({ status: 'ok', id: 1 });
  });

  it('應將原始數據包裝為 success: true 格式', () => {
    const req = createMockReq();
    const { res, jsonMock } = createMockRes();
    const next = jest.fn();
    responseFormatter(req, res, next);
    res.json({ id: 1, name: 'test' });
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { id: 1, name: 'test' },
        meta: expect.objectContaining({ request_id: 'req-123' }),
      })
    );
  });

  it('原始數據含 status 時應透出到頂層', () => {
    const req = createMockReq();
    const { res, jsonMock } = createMockRes();
    const next = jest.fn();
    responseFormatter(req, res, next);
    res.json({ status: 'pending', id: 1 });
    const callArg = jsonMock.mock.calls[0][0] as { success: boolean; status: string; data: object };
    expect(callArg.success).toBe(true);
    expect(callArg.status).toBe('pending');
    expect(callArg.data).toEqual({ status: 'pending', id: 1 });
  });

  it('應調用 next()', () => {
    const req = createMockReq();
    const { res } = createMockRes();
    const next = jest.fn();
    responseFormatter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('data 為 null 時應不崩潰並包裝為 success 格式（邊界：防禦性）', () => {
    const req = createMockReq();
    const { res, jsonMock } = createMockRes();
    const next = jest.fn();
    responseFormatter(req, res, next);
    res.json(null as unknown as object);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: null,
        meta: expect.objectContaining({ request_id: 'req-123' }),
      })
    );
  });

  it('data 為 undefined 時應不崩潰並包裝為 success 格式（邊界：防禦性）', () => {
    const req = createMockReq();
    const { res, jsonMock } = createMockRes();
    const next = jest.fn();
    responseFormatter(req, res, next);
    res.json(undefined as unknown as object);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: undefined,
        meta: expect.objectContaining({ request_id: 'req-123' }),
      })
    );
  });

  it('data 含 success: false 時應仍添加 meta（錯誤響應格式）', () => {
    const req = createMockReq();
    const { res, jsonMock } = createMockRes();
    const next = jest.fn();
    responseFormatter(req, res, next);
    res.json({ success: false, error: { code: 'ERR', message: 'fail' } });
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        meta: expect.objectContaining({ request_id: 'req-123' }),
      })
    );
  });
});
