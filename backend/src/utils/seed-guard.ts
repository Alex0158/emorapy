const PRODUCTION_HOST_PATTERNS = [
  /supabase\.co/i,
  /railway\.internal/i,
  /rlwy\.net/i,
  /amazonaws\.com/i,
  /neon\.tech/i,
];

const KNOWN_SAFE_REMOTE_HOST_FRAGMENTS = [
  // Mother Bear Court Dev Supabase project ref, documented in AGENTS.md.
  'lbukyqztkkkztfrfltlh',
];

export type SeedGuardEnv = {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  ALLOW_PRODUCTION_SEED?: string;
};

export function isLikelyProductionDatabase(databaseUrl?: string): boolean {
  if (!databaseUrl) return false;
  try {
    const url = new URL(databaseUrl);
    const host = url.hostname;
    const dbName = url.pathname.replace(/^\//, '').toLowerCase();
    const isKnownSafeRemoteHost = KNOWN_SAFE_REMOTE_HOST_FRAGMENTS.some((fragment) => host.includes(fragment));
    const isNamedNonProduction = /(dev|test|local|staging)/i.test(dbName);
    return PRODUCTION_HOST_PATTERNS.some((pattern) => pattern.test(host)) && !isKnownSafeRemoteHost && !isNamedNonProduction;
  } catch {
    return false;
  }
}

export function assertSeedAllowed(env?: SeedGuardEnv): void {
  const source = env ?? process.env;
  const override = source.ALLOW_PRODUCTION_SEED === 'true';
  const productionNodeEnv = source.NODE_ENV === 'production';
  const likelyProductionDb = isLikelyProductionDatabase(source.DATABASE_URL);

  if ((productionNodeEnv || likelyProductionDb) && !override) {
    throw new Error(
      [
        'Refusing to run prisma seed in a production-like environment.',
        'Set ALLOW_PRODUCTION_SEED=true only after verifying the target database and seed contents.',
      ].join(' ')
    );
  }
}
