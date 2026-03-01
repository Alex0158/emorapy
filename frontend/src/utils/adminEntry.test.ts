import { afterEach, describe, expect, it } from 'vitest';
import { getAdminLoginUrl, hasAdminLoginUrl } from './adminEntry';

const originalValue = import.meta.env.VITE_ADMIN_LOGIN_URL;

describe('adminEntry', () => {
  afterEach(() => {
    (import.meta.env as { VITE_ADMIN_LOGIN_URL?: string }).VITE_ADMIN_LOGIN_URL = originalValue;
  });

  it('應接受絕對 URL', () => {
    (import.meta.env as { VITE_ADMIN_LOGIN_URL?: string }).VITE_ADMIN_LOGIN_URL =
      'https://admin.example.com/admin/login';
    expect(getAdminLoginUrl()).toBe('https://admin.example.com/admin/login');
    expect(hasAdminLoginUrl()).toBe(true);
  });

  it('應拒絕相對路徑', () => {
    (import.meta.env as { VITE_ADMIN_LOGIN_URL?: string }).VITE_ADMIN_LOGIN_URL = '/admin/login';
    expect(getAdminLoginUrl()).toBeNull();
    expect(hasAdminLoginUrl()).toBe(false);
  });

  it('應拒絕空值', () => {
    (import.meta.env as { VITE_ADMIN_LOGIN_URL?: string }).VITE_ADMIN_LOGIN_URL = '';
    expect(getAdminLoginUrl()).toBeNull();
    expect(hasAdminLoginUrl()).toBe(false);
  });

  it('應拒絕非 http/https 協議', () => {
    (import.meta.env as { VITE_ADMIN_LOGIN_URL?: string }).VITE_ADMIN_LOGIN_URL =
      'javascript:alert(1)';
    expect(getAdminLoginUrl()).toBeNull();
    expect(hasAdminLoginUrl()).toBe(false);
  });
});
