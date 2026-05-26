#!/usr/bin/env node

import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('.', import.meta.url).pathname, '..');

const FORBIDDEN_FRONTEND_ADMIN_PATHS = [
  'frontend/src/pages/Admin',
  'frontend/src/components/common/AdminPermissionRoute.tsx',
  'frontend/src/components/common/AdminSectionLayout.tsx',
  'frontend/src/hooks/useAdminAccess.ts',
  'frontend/src/hooks/useAdminJobStats.ts',
  'frontend/src/hooks/useAdminMe.ts',
  'frontend/src/hooks/useAdminSession.ts',
  'frontend/src/hooks/useAdminToken.ts',
  'frontend/src/hooks/useAdminTokenEditor.ts',
  'frontend/src/services/api/admin.ts',
  'frontend/src/types/admin.ts',
  'frontend/src/utils/adminJobStatsQuery.ts',
  'frontend/src/utils/adminOpsJobsViewState.ts',
  'frontend/src/utils/adminTokenState.ts',
];

function containsFile(targetPath) {
  if (!existsSync(targetPath)) return false;
  const stat = statSync(targetPath);
  if (stat.isFile()) return true;
  if (!stat.isDirectory()) return false;
  return readdirSync(targetPath, { withFileTypes: true }).some((entry) => {
    const childPath = path.join(targetPath, entry.name);
    if (entry.isFile()) return true;
    if (entry.isDirectory()) return containsFile(childPath);
    return false;
  });
}

const forbidden = FORBIDDEN_FRONTEND_ADMIN_PATHS.filter((relativePath) =>
  containsFile(path.join(repoRoot, relativePath))
);

if (forbidden.length > 0) {
  console.error('Main frontend admin boundary check failed.');
  console.error('frontend/ must only keep AdminRedirect and adminEntry URL helpers; Admin Web implementation belongs in frontend-admin/.');
  for (const relativePath of forbidden) {
    console.error(`- forbidden main-frontend Admin implementation path: ${relativePath}`);
  }
  process.exit(1);
}

console.log('Main frontend admin boundary check passed.');
