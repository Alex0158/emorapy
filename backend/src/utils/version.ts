import packageJson from '../../package.json';

const COMMIT_SHA_ENV_KEYS = [
  'CJ_COMMIT_SHA',
  'RAILWAY_GIT_COMMIT_SHA',
  'VERCEL_GIT_COMMIT_SHA',
  'GITHUB_SHA',
  'SOURCE_VERSION',
  'COMMIT_SHA',
] as const;

function resolveCommitSha(): string {
  for (const key of COMMIT_SHA_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return 'unknown';
}

export function buildBackendVersionManifest() {
  const commitSha = resolveCommitSha();

  return {
    service: 'backend',
    version: packageJson.version || '1.0.0',
    commitSha,
    commitShortSha: commitSha === 'unknown' ? 'unknown' : commitSha.slice(0, 7),
    timestamp: new Date().toISOString(),
  };
}
