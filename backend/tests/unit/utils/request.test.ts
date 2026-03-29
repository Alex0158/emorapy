/**
 * utils/request 單元測試
 */
import { describe, it, expect } from '@jest/globals';
import {
  getAuthUserId,
  getAuthUserIdOptional,
  getRequestId,
  getSessionId,
  getSessionIdFromSources,
} from '../../../src/utils/request';
import type { Request } from 'express';
import { AppError } from '../../../src/utils/errors';

function mockReq(overrides: Partial<{
  user?: { id: string; email: string };
  requestId?: string;
  sessionId?: string;
}> = {}): Request {
  return { user: undefined, requestId: undefined, sessionId: undefined, ...overrides } as Request;
}

describe('utils/request', () => {
  describe('getAuthUserId', () => {
    it('應在 user 存在時返回 id', () => {
      const req = mockReq({ user: { id: 'uid-1', email: 'a@b.com' } });
      expect(getAuthUserId(req)).toBe('uid-1');
    });

    it('應在 user 為 undefined 時拋 UNAUTHORIZED', () => {
      const req = mockReq();
      expect(() => getAuthUserId(req)).toThrow(AppError);
      try {
        getAuthUserId(req);
      } catch (e) {
        expect((e as AppError).code).toBe('UNAUTHORIZED');
        expect((e as AppError).statusCode).toBe(401);
      }
    });

    it('應在 user.id 為 undefined 時拋 UNAUTHORIZED', () => {
      const req = mockReq({ user: { id: undefined as unknown as string, email: 'a@b.com' } });
      expect(() => getAuthUserId(req)).toThrow(AppError);
      try {
        getAuthUserId(req);
      } catch (e) {
        expect((e as AppError).code).toBe('UNAUTHORIZED');
      }
    });
  });

  describe('getAuthUserIdOptional', () => {
    it('應在 user 存在時返回 id', () => {
      const req = mockReq({ user: { id: 'uid-2', email: 'x@y.com' } });
      expect(getAuthUserIdOptional(req)).toBe('uid-2');
    });

    it('應在 user 為 undefined 時返回 undefined', () => {
      const req = mockReq();
      expect(getAuthUserIdOptional(req)).toBeUndefined();
    });
  });

  describe('getRequestId', () => {
    it('應返回 requestId 若存在', () => {
      const req = mockReq({ requestId: 'req-123' });
      expect(getRequestId(req)).toBe('req-123');
    });

    it('應在 requestId 為 undefined 時返回 unknown', () => {
      const req = mockReq();
      expect(getRequestId(req)).toBe('unknown');
    });
  });

  describe('getSessionId', () => {
    it('應返回 sessionId 若存在', () => {
      const req = mockReq({ sessionId: 'sess-456' });
      expect(getSessionId(req)).toBe('sess-456');
    });

    it('應在 sessionId 為 undefined 時返回 undefined', () => {
      const req = mockReq();
      expect(getSessionId(req)).toBeUndefined();
    });
  });

  describe('getSessionIdFromSources', () => {
    it('應優先返回 header 中的 sessionId', () => {
      const req = {
        headers: { 'x-session-id': 'header-sid' },
        query: { session_id: 'query-sid' },
      } as unknown as Request;
      const result = getSessionIdFromSources(req);
      expect(result.sessionId).toBe('header-sid');
      expect(result.hasConflict).toBe(true);
    });

    it('header 為 string[] 時應取第一個值', () => {
      const req = {
        headers: { 'x-session-id': ['sid-1', 'sid-2'] },
        query: {},
      } as unknown as Request;
      const result = getSessionIdFromSources(req);
      expect(result.headerSessionId).toBe('sid-1');
      expect(result.sessionId).toBe('sid-1');
      expect(result.hasConflict).toBe(false);
    });

    it('僅 query 提供時應返回 query sessionId', () => {
      const req = {
        headers: {},
        query: { session_id: 'query-only' },
      } as unknown as Request;
      const result = getSessionIdFromSources(req);
      expect(result.sessionId).toBe('query-only');
      expect(result.hasConflict).toBe(false);
    });

    it('header 與 query 皆無時應返回 undefined 且 hasConflict 為 false', () => {
      const req = { headers: {}, query: {} } as unknown as Request;
      const result = getSessionIdFromSources(req);
      expect(result.sessionId).toBeUndefined();
      expect(result.headerSessionId).toBeUndefined();
      expect(result.querySessionId).toBeUndefined();
      expect(result.hasConflict).toBe(false);
    });

    it('query.session_id 為陣列時應忽略（非字串）', () => {
      const req = {
        headers: {},
        query: { session_id: ['a', 'b'] },
      } as unknown as Request;
      const result = getSessionIdFromSources(req);
      expect(result.querySessionId).toBeUndefined();
      expect(result.sessionId).toBeUndefined();
    });

    it('header 與 query 相同時 hasConflict 應為 false', () => {
      const req = {
        headers: { 'x-session-id': 'same-sid' },
        query: { session_id: 'same-sid' },
      } as unknown as Request;
      const result = getSessionIdFromSources(req);
      expect(result.sessionId).toBe('same-sid');
      expect(result.hasConflict).toBe(false);
    });

    it('query 為 undefined 時應不崩潰且返回 header 或 undefined', () => {
      const req = { headers: { 'x-session-id': 'h-sid' }, query: undefined } as unknown as Request;
      const result = getSessionIdFromSources(req);
      expect(result.sessionId).toBe('h-sid');
      expect(result.hasConflict).toBe(false);
    });

    it('query 為 undefined 且 header 無 session 時應返回 undefined', () => {
      const req = { headers: {}, query: undefined } as unknown as Request;
      const result = getSessionIdFromSources(req);
      expect(result.sessionId).toBeUndefined();
      expect(result.hasConflict).toBe(false);
    });
  });
});
