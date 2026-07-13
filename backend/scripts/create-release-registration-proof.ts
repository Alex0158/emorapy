import crypto from 'crypto';
import { Prisma, PrismaClient } from '../src/types/prisma-client';

const FIXTURE_EMAIL_PATTERN = /^claim-smoke-[a-z0-9_-]+@example\.com$/;
const FIXTURE_ID_PREFIX = 'release-fixture-';
const OTP_TTL_MS = 5 * 60 * 1000;
const PROOF_TTL_MS = 10 * 60 * 1000;

export interface ReleaseFixtureInput {
  email: string;
  releaseGate: '1';
}

function readEmailArgument(argv: string[]): string {
  const inline = argv.find((value) => value.startsWith('--email='));
  if (inline) return inline.slice('--email='.length);

  const index = argv.indexOf('--email');
  return index >= 0 ? argv[index + 1] || '' : '';
}

export function validateReleaseFixtureRequest(
  envSource: NodeJS.ProcessEnv,
  argv: string[]
): ReleaseFixtureInput {
  if (envSource.EMORAPY_RELEASE_GATE !== '1') {
    throw new Error('EMORAPY_RELEASE_GATE=1 is required');
  }
  if (!envSource.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const email = readEmailArgument(argv).trim().toLowerCase();
  if (!FIXTURE_EMAIL_PATTERN.test(email)) {
    throw new Error('email must match claim-smoke-<id>@example.com');
  }
  return { email, releaseGate: '1' };
}

export async function createReleaseRegistrationProof(
  prisma: PrismaClient,
  input: ReleaseFixtureInput,
  now: Date = new Date()
): Promise<string> {
  if (input.releaseGate !== '1' || !FIXTURE_EMAIL_PATTERN.test(input.email)) {
    throw new Error('release fixture authorization is invalid');
  }
  const id = `${FIXTURE_ID_PREFIX}${crypto.randomUUID()}`;
  const proof = `rp1_${crypto.randomBytes(32).toString('base64url')}`;
  const proofDigest = crypto.createHash('sha256').update(proof).digest('hex');

  await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existingUser) {
      throw new Error('fixture email already belongs to a user');
    }

    await tx.authChallenge.updateMany({
      where: {
        email: input.email,
        type: 'register',
        consumed_at: null,
        invalidated_at: null,
      },
      data: { invalidated_at: now },
    });

    await tx.authChallenge.create({
      data: {
        id,
        email: input.email,
        type: 'register',
        code_digest: crypto.randomBytes(32).toString('hex'),
        source: 'release_fixture',
        delivery_status: 'release_fixture_ready',
        expires_at: new Date(now.getTime() + OTP_TTL_MS),
        verified_at: now,
        registration_proof_digest: proofDigest,
        registration_proof_expires_at: new Date(now.getTime() + PROOF_TTL_MS),
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return proof;
}

async function main(): Promise<void> {
  const input = validateReleaseFixtureRequest(process.env, process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const proof = await createReleaseRegistrationProof(prisma, input);
    process.stdout.write(`${proof}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : 'unknown failure';
    process.stderr.write(`[release-registration-proof] ${message}\n`);
    process.exitCode = 1;
  });
}
