/**
 * middleware/validator 單元測試
 */
import { describe, it, expect, jest } from '@jest/globals';
import Joi from 'joi';
import type { Request, Response, NextFunction } from 'express';
import { validate } from '../../../src/middleware/validator';

function createMockReq(overrides: Partial<Request> = {}): Request {
  return { body: {}, params: {}, query: {}, ...overrides } as Request;
}

function createMockRes(): Response {
  return {} as Response;
}

describe('middleware/validator', () => {
  it('body 驗證失敗應 next(VALIDATION_ERROR)', () => {
    const schema = {
      body: Joi.object({ name: Joi.string().required() }),
    };
    const req = createMockReq({ body: {} });
    const res = createMockRes();
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = next.mock.calls[0][0] as { code: string; message: string };
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toContain('name');
  });

  it('body 為 undefined 時應正常處理不拋錯（邊界：異常請求）', () => {
    const schema = {
      body: Joi.object({ name: Joi.string().required() }),
    };
    const req = createMockReq({ body: undefined });
    const res = createMockRes();
    const next = jest.fn();
    expect(() => validate(schema)(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('body 驗證通過應 next()', () => {
    const schema = {
      body: Joi.object({ name: Joi.string().required() }),
    };
    const req = createMockReq({ body: { name: 'ok' } });
    const res = createMockRes();
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('params 有值且驗證失敗應 next(VALIDATION_ERROR)', () => {
    const schema = {
      params: Joi.object({ id: Joi.string().uuid().required() }),
    };
    const req = createMockReq({ params: { id: 'not-uuid' } });
    const res = createMockRes();
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = next.mock.calls[0][0] as { code: string };
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('params 有值且驗證通過應 next()', () => {
    const schema = {
      params: Joi.object({ id: Joi.string().uuid().required() }),
    };
    const req = createMockReq({
      params: { id: '550e8400-e29b-41d4-a716-446655440000' },
    });
    const res = createMockRes();
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('params 為空時跳過 params 驗證', () => {
    const schema = {
      params: Joi.object({ id: Joi.string().required() }),
    };
    const req = createMockReq({ params: {} });
    const res = createMockRes();
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('query 驗證失敗應 next(VALIDATION_ERROR)', () => {
    const schema = {
      query: Joi.object({ page: Joi.number().integer().min(1).required() }),
    };
    const req = createMockReq({ query: { page: 'invalid' } });
    const res = createMockRes();
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = next.mock.calls[0][0] as { code: string };
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('body、params、query 皆通過應 next()', () => {
    const schema = {
      body: Joi.object({ name: Joi.string() }),
      params: Joi.object({ id: Joi.string() }),
      query: Joi.object({ page: Joi.number() }),
    };
    const req = createMockReq({
      body: { name: 'a' },
      params: { id: 'x' },
      query: { page: '1' },
    });
    const res = createMockRes();
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('多處驗證失敗應合併錯誤訊息', () => {
    const schema = {
      body: Joi.object({ name: Joi.string().required() }),
      query: Joi.object({ limit: Joi.number().required() }),
    };
    const req = createMockReq({ body: {}, query: {} });
    const res = createMockRes();
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    const err = next.mock.calls[0][0] as { message: string };
    expect(err.message).toMatch(/;/);
  });

  it('schema 為空物件時應直接 next()（邊界：無驗證需求）', () => {
    const schema = {};
    const req = createMockReq();
    const res = createMockRes();
    const next = jest.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('query 為 undefined 時應正常處理不拋錯（邊界：異常請求）', () => {
    const schema = {
      query: Joi.object({ page: Joi.number().optional() }),
    };
    const req = createMockReq({ query: undefined });
    const res = createMockRes();
    const next = jest.fn();
    expect(() => validate(schema)(req, res, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
