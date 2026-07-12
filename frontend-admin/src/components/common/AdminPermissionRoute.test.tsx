import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
	token: 'ready-token',
	access: {
		adminMeQuery: { isLoading: false, error: null as unknown },
		permissions: ['admin:all'] as string[],
		hasPermission: true,
		missingPermissions: [] as string[],
	},
}));

vi.mock('@/hooks/useAdminToken', () => ({ useAdminToken: () => state.token }));
vi.mock('@/utils/adminTokenState', () => ({
	deriveAdminTokenStatus: (token: string) => ({
		tokenPresent: Boolean(token),
		tokenReady: token === 'ready-token',
		tokenFormatInvalid: Boolean(token) && token !== 'ready-token',
	}),
}));
vi.mock('@/hooks/useAdminAccess', () => ({ useAdminAccess: () => state.access }));
vi.mock('@/utils/i18n', () => ({
	t: (key: string, params?: Record<string, string>) =>
		params ? `${key}:${Object.values(params).join(',')}` : key,
}));

import AdminPermissionRoute from './AdminPermissionRoute';

function renderGuard(requiredPermissions = ['config:read']) {
	return renderToStaticMarkup(
		<MemoryRouter>
			<AdminPermissionRoute requiredPermissions={requiredPermissions}>
				<div>protected-content</div>
			</AdminPermissionRoute>
		</MemoryRouter>,
	);
}

beforeEach(() => {
	state.token = 'ready-token';
	state.access = {
		adminMeQuery: { isLoading: false, error: null },
		permissions: ['admin:all'],
		hasPermission: true,
		missingPermissions: [],
	};
});

describe('AdminPermissionRoute', () => {
	it('missing or malformed token shows the recovery guard', () => {
		state.token = '';
		const html = renderGuard();
		expect(html).toContain('role="alert"');
		expect(html).toContain('admin.ops.tokenRequired');
	});

	it('shows a status while the admin identity is loading', () => {
		state.access.adminMeQuery = { isLoading: true, error: null };
		const html = renderGuard();
		expect(html).toContain('role="status"');
		expect(html).toContain('admin.ops.verifyingAccess');
	});

	it('shows a recoverable network state without pretending access was denied', () => {
		state.access.adminMeQuery = { isLoading: false, error: { code: 'NETWORK_ERROR' } };
		const html = renderGuard();
		expect(html).toContain('role="alert"');
		expect(html).toContain('common.networkError');
		expect(html).toContain('admin.shell.networkRecovery');
	});

	it('forbidden users can return to their first permitted workspace', () => {
		state.access = {
			adminMeQuery: { isLoading: false, error: null },
			permissions: ['ops:read'],
			hasPermission: false,
			missingPermissions: ['config:read'],
		};
		const html = renderGuard();
		expect(html).toContain('role="alert"');
		expect(html).toContain('admin.ops.accessDenied');
		expect(html).toContain('href="/admin/ops/jobs"');
	});

	it('renders protected content only after permission is confirmed', () => {
		const html = renderGuard();
		expect(html).toContain('protected-content');
		expect(html).not.toContain('role="alert"');
	});
});
