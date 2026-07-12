import fs from 'node:fs/promises';
import path from 'node:path';

const APP_USE_RE = /app\.use\(\s*['"]([^'"]+)['"]\s*,\s*([A-Za-z0-9_]+)\s*\);/g;
const PATH_LINE_RE = /^(\s*)path:\s*['"]([^'"]+)['"]/;
const INDEX_LINE_RE = /^(\s*)index:\s*true\b/;

function normalizePosix(value) {
  return value.split(path.sep).join(path.posix.sep);
}

function kebabFromCamel(value) {
  return value
    .replace(/Routes?$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

function joinRoutePath(basePath, routePath) {
  if (!routePath || routePath === '/') {
    return basePath === '/' ? '/' : basePath.replace(/\/+$/, '') || '/';
  }

  if (routePath === '*') {
    return '*';
  }

  const normalizedBase = basePath === '/' ? '' : basePath.replace(/\/+$/, '');
  const normalizedRoute = routePath.startsWith('/') ? routePath : `/${routePath}`;
  const joined = `${normalizedBase}${normalizedRoute}` || '/';
  return joined.replace(/\/{2,}/g, '/');
}

function extractFirstStringLiteral(block) {
  const match = block.match(/['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

function extractLimiterNames(block) {
  return [...new Set([...block.matchAll(/\b([A-Za-z0-9_]+Limiter)\b/g)].map((match) => match[1]))];
}

function extractAdminPermissions(block) {
  const inline = [...block.matchAll(/requireAdminPermission\(\s*['"]([^'"]+)['"]\s*\)/g)].map(
    (match) => match[1]
  );
  const arrayMatches = [...block.matchAll(/requiredPermissions=\{\[([^\]]+)\]\}/g)].flatMap(
    (match) => [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((item) => item[1])
  );
  return [...new Set([...inline, ...arrayMatches])];
}

function detectAuthMode(block) {
  if (block.includes('authenticateAdmin') || block.includes('requireAdminPermission')) {
    return 'Admin';
  }
  if (block.includes('validateSession') || block.includes('optionalAuthenticate')) {
    return 'User/Session';
  }
  if (block.includes('authenticate')) {
    return 'User';
  }
  return 'Public';
}

async function readFileUtf8(filePath) {
  return fs.readFile(filePath, 'utf8');
}

function extractExpressRouteCalls(content) {
  const calls = [];
  const methodRe = /router\.(get|post|put|patch|delete)\(/g;
  let match;

  while ((match = methodRe.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    let index = match.index + match[0].length;
    let depth = 1;
    let quote = null;
    let escaped = false;

    while (index < content.length && depth > 0) {
      const char = content[index];

      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === quote) {
          quote = null;
        }
        index += 1;
        continue;
      }

      if (char === '"' || char === "'" || char === '`') {
        quote = char;
        index += 1;
        continue;
      }

      if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth -= 1;
      }

      index += 1;
    }

    const block = content.slice(match.index + match[0].length, index - 1);
    calls.push({ method, block });
  }

  return calls;
}

export async function extractBackendRouteTruth(repoRoot) {
  const appPath = path.join(repoRoot, 'backend/src/app.ts');
  const routesRoot = path.join(repoRoot, 'backend/src/routes');
  const appContent = await readFileUtf8(appPath);
  const mounts = [];

  let mountMatch;
  while ((mountMatch = APP_USE_RE.exec(appContent)) !== null) {
    const [, basePath, routerVariable] = mountMatch;
    mounts.push({
      basePath,
      routerVariable,
      routeFile: path.join(routesRoot, `${kebabFromCamel(routerVariable)}.routes.ts`),
    });
  }

  const endpoints = [];
  for (const mount of mounts) {
    const routeContent = await readFileUtf8(mount.routeFile);
    for (const routeCall of extractExpressRouteCalls(routeContent)) {
      const { method, block } = routeCall;
      const routePath = extractFirstStringLiteral(block);
      if (!routePath) {
        continue;
      }
      endpoints.push({
        method,
        path: joinRoutePath(mount.basePath, routePath),
        basePath: mount.basePath,
        routeFile: normalizePosix(path.relative(repoRoot, mount.routeFile)),
        authMode: detectAuthMode(block),
        limiters: extractLimiterNames(block),
        permissions: extractAdminPermissions(block),
      });
    }
  }

  endpoints.sort((left, right) => {
    const pathCompare = left.path.localeCompare(right.path);
    return pathCompare !== 0 ? pathCompare : left.method.localeCompare(right.method);
  });

  return {
    appPath: normalizePosix(path.relative(repoRoot, appPath)),
    mounts: mounts.map((mount) => ({
      ...mount,
      routeFile: normalizePosix(path.relative(repoRoot, mount.routeFile)),
    })),
    endpoints,
  };
}

function collectRouterRouteEntries(content) {
  const lines = content.split('\n');
  const routeLines = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const pathMatch = line.match(PATH_LINE_RE);
    if (pathMatch) {
      routeLines.push({
        lineIndex: index,
        indent: pathMatch[1].length,
        rawPath: pathMatch[2],
      });
      continue;
    }

    const indexMatch = line.match(INDEX_LINE_RE);
    if (indexMatch) {
      routeLines.push({
        lineIndex: index,
        indent: indexMatch[1].length,
        rawPath: '__index__',
      });
    }
  }

  return routeLines;
}

function normalizeAbsolutePath(value) {
  if (value === '*') {
    return '*';
  }
  return value.startsWith('/') ? value : `/${value}`;
}

function buildRouteWindow(lines, startIndex, stopIndex) {
  return lines.slice(startIndex, stopIndex).join('\n');
}

function deriveGuardType(windowText) {
  if (windowText.includes('AdminPermissionRoute')) {
    return 'AdminPermissionRoute';
  }
  if (windowText.includes('ProtectedRoute')) {
    return 'ProtectedRoute';
  }
  if (windowText.includes('PublicRoute')) {
    return 'PublicRoute';
  }
  return 'Public';
}

function deriveRouteKind(windowText, rawPath) {
  if (rawPath === '__index__' || windowText.includes('<Navigate')) {
    return 'redirect';
  }
  return 'page';
}

function deriveAdminPermissions(windowText) {
  const match = windowText.match(/requiredPermissions=\{\[([^\]]+)\]\}/);
  if (!match) {
    return [];
  }
  return [...new Set([...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((item) => item[1]))];
}

function extractRouterTruthFromContent(content) {
  const lines = content.split('\n');
  const routeEntries = collectRouterRouteEntries(content);
  const stack = [];
  const extracted = [];

  for (let index = 0; index < routeEntries.length; index += 1) {
    const current = routeEntries[index];
    const next = routeEntries[index + 1];
    while (stack.length > 0 && stack.at(-1).indent >= current.indent) {
      stack.pop();
    }

    let fullPath;
    if (current.rawPath === '__index__') {
      const parent = stack.at(-1);
      fullPath = parent ? parent.fullPath : '/';
    } else if (current.rawPath === '*') {
      fullPath = '*';
    } else if (current.rawPath.startsWith('/')) {
      fullPath = normalizeAbsolutePath(current.rawPath);
    } else {
      const parent = stack.at(-1);
      fullPath = parent ? joinRoutePath(parent.fullPath, current.rawPath) : normalizeAbsolutePath(current.rawPath);
    }

    const stopIndex = next ? next.lineIndex : lines.length;
    const windowText = buildRouteWindow(lines, current.lineIndex, stopIndex);
    const hasChildren = windowText.includes('children:');

    extracted.push({
      rawPath: current.rawPath,
      fullPath,
      indent: current.indent,
      guardType: deriveGuardType(windowText),
      routeKind: deriveRouteKind(windowText, current.rawPath),
      permissions: deriveAdminPermissions(windowText),
    });

    if (current.rawPath !== '__index__' && hasChildren) {
      stack.push({
        indent: current.indent,
        fullPath,
      });
    }
  }

  return extracted;
}

function extractAdminNavigationTruthFromContent(content) {
  const listMatch = content.match(
    /export const ADMIN_NAVIGATION_ITEMS:[^=]+?=\s*\[([\s\S]*?)\n\];/
  );
  if (!listMatch) {
    return [];
  }

  const routes = [];
  const itemRe = /\{([\s\S]*?)\n\s*\},/g;
  let itemMatch;
  while ((itemMatch = itemRe.exec(listMatch[1])) !== null) {
    const block = itemMatch[1];
    const pathMatch = block.match(/\bpath:\s*["']([^"']+)["']/);
    if (!pathMatch) continue;
    const permissionsMatch = block.match(/\brequiredPermissions:\s*\[([^\]]*)\]/);
    const permissions = permissionsMatch
      ? [...permissionsMatch[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1])
      : [];
    routes.push({
      rawPath: pathMatch[1],
      fullPath: normalizeAbsolutePath(pathMatch[1]),
      indent: 0,
      guardType: 'AdminPermissionRoute',
      routeKind: 'page',
      permissions,
    });
  }
  return routes;
}

export async function extractFrontendRouteTruth(repoRoot) {
  const frontendRouterPath = path.join(repoRoot, 'frontend/src/router/index.tsx');
  const adminRouterPath = path.join(repoRoot, 'frontend-admin/src/router.tsx');
  const adminNavigationPath = path.join(
    repoRoot,
    'frontend-admin/src/config/adminNavigation.ts'
  );
  const [frontendContent, adminContent, adminNavigationContent] = await Promise.all([
    readFileUtf8(frontendRouterPath),
    readFileUtf8(adminRouterPath),
    readFileUtf8(adminNavigationPath),
  ]);

  const frontendRoutes = extractRouterTruthFromContent(frontendContent);
  const adminRoutes = extractRouterTruthFromContent(adminContent);
  const knownAdminPaths = new Set(adminRoutes.map((route) => route.fullPath));
  for (const route of extractAdminNavigationTruthFromContent(adminNavigationContent)) {
    if (!knownAdminPaths.has(route.fullPath)) {
      adminRoutes.push(route);
      knownAdminPaths.add(route.fullPath);
    }
  }

  return {
    frontendRouterPath: normalizePosix(path.relative(repoRoot, frontendRouterPath)),
    adminRouterPath: normalizePosix(path.relative(repoRoot, adminRouterPath)),
    adminNavigationPath: normalizePosix(path.relative(repoRoot, adminNavigationPath)),
    frontendRoutes,
    adminRoutes,
  };
}

export async function extractPrismaEnumTruth(repoRoot) {
  const schemaPath = path.join(repoRoot, 'backend/prisma/schema.prisma');
  const schemaContent = await readFileUtf8(schemaPath);
  const enums = {};
  const enumBlockRe = /enum\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\n\}/g;

  let match;
  while ((match = enumBlockRe.exec(schemaContent)) !== null) {
    const [, enumName, block] = match;
    const values = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//'))
      .map((line) => line.split(/\s+/)[0]);
    enums[enumName] = values;
  }

  return {
    schemaPath: normalizePosix(path.relative(repoRoot, schemaPath)),
    enums,
  };
}

export async function extractCoreDocsTruth(repoRoot) {
  const [backend, frontend, prisma] = await Promise.all([
    extractBackendRouteTruth(repoRoot),
    extractFrontendRouteTruth(repoRoot),
    extractPrismaEnumTruth(repoRoot),
  ]);

  const frontendPageRoutes = frontend.frontendRoutes.filter((route) => route.rawPath !== '__index__');
  const adminExternalRoutes = frontend.adminRoutes.filter(
    (route) =>
      route.fullPath !== '*' &&
      route.fullPath !== '/' &&
      route.fullPath !== '/admin' &&
      route.fullPath.startsWith('/admin')
  );

  return {
    backend,
    frontend: {
      ...frontend,
      frontendPageRoutes,
      adminExternalRoutes,
      stats: {
        totalRoutes: frontendPageRoutes.length,
        protectedRoutes: frontendPageRoutes.filter((route) => route.guardType === 'ProtectedRoute').length,
        publicRoutes: frontendPageRoutes.filter((route) => route.guardType === 'PublicRoute').length,
        unguardedRoutes: frontendPageRoutes.filter((route) => route.guardType === 'Public').length,
      },
    },
    prisma,
  };
}
