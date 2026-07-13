import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const rootUrl = new URL('../../', import.meta.url);

async function readRepoFile(path) {
  return readFile(new URL(path, rootUrl), 'utf8');
}

function nodeHeredocBodies(source) {
  const lines = source.split(/\r?\n/);
  const bodies = [];
  let current = null;

  for (const [index, line] of lines.entries()) {
    if (current === null && /<<['"]?NODE['"]?\s*$/.test(line)) {
      current = { startLine: index + 1, lines: [] };
      continue;
    }
    if (current && line === 'NODE') {
      bodies.push({ ...current, body: current.lines.join('\n') });
      current = null;
      continue;
    }
    if (current) current.lines.push(line);
  }

  assert.equal(current, null, 'unterminated NODE heredoc');
  return bodies;
}

test('claim smoke keeps Bash helpers outside embedded Node heredocs', async () => {
  const source = await readRepoFile('scripts/smoke-claim-session-production-like.sh');
  const heredocs = nodeHeredocBodies(source);

  for (const heredoc of heredocs) {
    assert.doesNotMatch(
      heredoc.body,
      /^\s*[a-z_][a-z0-9_]*\s*\(\)\s*\{/im,
      `Bash function definition found inside NODE heredoc starting at line ${heredoc.startLine}`
    );
  }

  assert.match(source, /^read_verification_code_from_sink\(\)\s*\{/m);
  assert.match(source, /^create_release_registration_proof\(\)\s*\{/m);
  assert.doesNotMatch(source, /emailVerification\.findFirst/);
});

test('claim smoke does not emit raw auth response bodies on failure', async () => {
  const source = await readRepoFile('scripts/smoke-claim-session-production-like.sh');

  assert.doesNotMatch(
    source,
    /Last response body:\s*\$\{HTTP_BODY\}/,
    'raw HTTP_BODY can contain a registration proof or JWT and must be redacted before CI logging'
  );
});

test('CI email smoke uses authenticated implicit TLS and reads the delivered message', async () => {
  const [ci, sink] = await Promise.all([
    readRepoFile('.github/workflows/ci.yml'),
    readRepoFile('scripts/ci-smtps-sink.mjs'),
  ]);

  assert.match(ci, /Start authenticated TLS SMTP sink/);
  assert.match(ci, /SMTP_SECURE:\s*['"]true['"]/);
  assert.match(ci, /SMTP_REQUIRE_TLS:\s*['"]true['"]/);
  assert.match(ci, /SMTP_SINK_API_URL:\s*http:\/\/127\.0\.0\.1:8025/);
  assert.match(ci, /\/health\/ready/);
  assert.match(sink, /tls\.createServer/);
  assert.match(sink, /AUTH PLAIN LOGIN/);
  assert.match(sink, /listen\(smtpPort, '127\.0\.0\.1'/);
  assert.match(sink, /listen\(apiPort, '127\.0\.0\.1'/);
  assert.match(sink, /verificationCode:\s*extractVerificationCodeFromMime\(raw\)/);
  assert.match(ci, /Run email registration and claim smoke/);
  assert.match(
    await readRepoFile('scripts/smoke-claim-session-production-like.sh'),
    /payload\.verificationCode/
  );
});

test('email acceptance and logging contracts fail closed without exposing auth secrets', async () => {
  const [emailService, logger, redaction] = await Promise.all([
    readRepoFile('backend/src/services/email.service.ts'),
    readRepoFile('backend/src/config/logger.ts'),
    readRepoFile('backend/src/utils/log-redaction.ts'),
  ]);

  assert.match(
    emailService,
    /function buildDeliveryReceipt[\s\S]*?rejected\.length > 0 \|\| accepted\.length === 0/,
    'the shared provider receipt boundary must reject empty acceptance and any rejection'
  );
  const sharedReceiptChecks = emailService.match(/buildDeliveryReceipt\(result\)/g) ?? [];
  assert.ok(
    sharedReceiptChecks.length >= 4,
    'verification, notification, and provider-canary sends must share the fail-closed receipt boundary'
  );

  const loggerRedactionStages = logger.match(/redactSensitiveMetadata\(\)/g) ?? [];
  assert.ok(
    loggerRedactionStages.length >= 2,
    'structured redaction must protect both base/file and console logger formats'
  );
  assert.match(redaction, /REGISTRATION_PROOF_PATTERN/);
  assert.match(redaction, /SIX_DIGIT_OTP_PATTERN/);
  assert.match(redaction, /authorization\|cookie\|email/);
  assert.match(redaction, /registration_\?proof\|secret\|token\|verification_\?code/);
});

test('production workflow requires exact-release provider acceptance after startup readiness', async () => {
  const workflow = await readRepoFile('.github/workflows/production-deploy-and-verify.yml');

  assert.doesNotMatch(workflow, /run_email_provider_canary/);
  assert.match(workflow, /EMAIL_CANARY_RECIPIENT is required/);
  assert.match(workflow, /providerCanaryRequired:\s*true/);
  assert.match(workflow, /status == "provider_accepted"/);
  assert.match(workflow, /\.releaseRef == \$sha/);
  assert.match(workflow, /\.acceptedAt[\s\S]*?test\("\^\[0-9\]/);
  assert.match(workflow, /not inbox delivery/i);
  assert.match(workflow, /emailDelivery\.status/);
  assert.match(workflow, /emailDelivery\.verifiedAt/);
  assert.doesNotMatch(workflow, /status == "(?:delivered|inbox_delivered)"/);

  const exactReleaseIndex = workflow.indexOf('- name: Verify exact backend and runtime database release');
  const providerCanaryIndex = workflow.indexOf('- name: Run required low-frequency email provider canary');
  assert.notEqual(exactReleaseIndex, -1);
  assert.notEqual(providerCanaryIndex, -1);
  assert.ok(
    exactReleaseIndex < providerCanaryIndex,
    'provider canary must run only after the exact deployed release and readiness are verified'
  );
  assert.match(workflow, /type: "production-release"/);
  assert.match(workflow, /ops:auth-email-normalization:check/);
  assert.match(workflow, /\.migrationCapabilityReady == true/);
  assert.match(workflow, /collisionGroupCount == 0/);
  assert.doesNotMatch(workflow, /temp\/chat-context-release/);
});
