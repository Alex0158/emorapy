import { emailService } from '../src/services/email.service';

function resolveReleaseRef(): string {
  return (
    process.env.EMORAPY_COMMIT_SHA
    || process.env.RAILWAY_GIT_COMMIT_SHA
    || process.env.GITHUB_SHA
    || 'unknown'
  );
}

async function main(): Promise<void> {
  const recipient = process.env.EMAIL_CANARY_RECIPIENT?.trim();
  if (!recipient) {
    throw new Error('EMAIL_CANARY_RECIPIENT is required');
  }

  const releaseRef = resolveReleaseRef();
  await emailService.initialize();
  const receipt = await emailService.sendProviderCanary(recipient, releaseRef);
  process.stdout.write(`${JSON.stringify({
    status: 'provider_accepted',
    recipientConfigured: true,
    releaseRef: releaseRef.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80) || 'unknown',
    acceptedAt: receipt.acceptedAt.toISOString(),
    providerMessageIdDigest: receipt.providerMessageIdDigest,
  })}\n`);
}

main().catch((error) => {
  const reason = error instanceof Error ? error.name : 'UnknownError';
  process.stderr.write(`Email provider canary failed: ${reason}\n`);
  process.exitCode = 1;
});
