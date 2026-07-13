import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  formatSafeResponseForError,
  runSmokeLifecycle,
  validateSmokeSafetyEnv,
} from '../../../scripts/web-p0-true-service-smoke';

const smokeSource = readFileSync(
  path.resolve(__dirname, '../../../scripts/web-p0-true-service-smoke.ts'),
  'utf8'
);
const chatFlowSource = smokeSource.slice(
  smokeSource.indexOf('const chat = await recordStep('),
  smokeSource.indexOf("await recordStep('db ownership and artifact sanity")
);

describe('web-p0-true-service-smoke safety env', () => {
  const baseEnv = {
    RUN_WEB_P0_TRUE_SERVICE_SMOKE: 'true',
    DATABASE_URL: 'postgresql://emorapy:emorapy_dev_pass@127.0.0.1:55432/emorapy_dev',
    WEB_P0_SMOKE_REPORT_PATH:
      'docs/核心開發文件/90-證據與盤點/環境與發版驗證/Web-P0-True-Service-test.json',
    SMTP_SINK_API_URL: 'http://127.0.0.1:8025',
  };

  it('allows local database target when mutating opt-in and report path are present', () => {
    expect(() => validateSmokeSafetyEnv(baseEnv)).not.toThrow();
  });

  it('requires explicit mutating opt-in', () => {
    expect(() =>
      validateSmokeSafetyEnv({
        ...baseEnv,
        RUN_WEB_P0_TRUE_SERVICE_SMOKE: 'false',
      })
    ).toThrow('RUN_WEB_P0_TRUE_SERVICE_SMOKE=true is required');
  });

  it('requires an evidence artifact path before mutation', () => {
    expect(() =>
      validateSmokeSafetyEnv({
        ...baseEnv,
        WEB_P0_SMOKE_REPORT_PATH: '',
      })
    ).toThrow('WEB_P0_SMOKE_REPORT_PATH is required');
  });

  it('requires an SMTP sink so auth proof cannot be obtained from DB plaintext', () => {
    expect(() =>
      validateSmokeSafetyEnv({
        ...baseEnv,
        SMTP_SINK_API_URL: '',
      })
    ).toThrow('SMTP_SINK_API_URL is required');
  });

  it('forbids disabling created-user cleanup', () => {
    expect(() =>
      validateSmokeSafetyEnv({
        ...baseEnv,
        WEB_P0_SMOKE_DISABLE_CREATED_USERS: 'false',
      })
    ).toThrow('cleanup is a pass condition');
  });

  it('rejects remote database targets without explicit override', () => {
    expect(() =>
      validateSmokeSafetyEnv({
        ...baseEnv,
        DATABASE_URL: 'postgresql://postgres:secret@db.example.supabase.co:5432/postgres',
      })
    ).toThrow('WEB_P0_SMOKE_ALLOW_REMOTE_DB=true is required');
  });

  it('allows remote database targets only with explicit override', () => {
    expect(() =>
      validateSmokeSafetyEnv({
        ...baseEnv,
        DATABASE_URL: 'postgresql://postgres:secret@db.example.supabase.co:5432/postgres',
        WEB_P0_SMOKE_ALLOW_REMOTE_DB: 'true',
      })
    ).not.toThrow();
  });
});

describe('web-p0-true-service-smoke sensitive failure output', () => {
  it('redacts registration proof, JWT, email and raw auth keys from status mismatch output', () => {
    const proof = `rp1_${'p'.repeat(43)}`;
    const jwt = `${'a'.repeat(12)}.${'b'.repeat(12)}.${'c'.repeat(12)}`;
    const rawBody = JSON.stringify({
      error: 'registration rejected for owner@example.com',
      data: {
        registration_proof: proof,
        token: jwt,
      },
    });

    const output = formatSafeResponseForError({
      body: JSON.parse(rawBody),
      text: rawBody,
    });

    expect(output).toContain('[redacted]');
    expect(output).toContain('[email-redacted]');
    expect(output).not.toContain(proof);
    expect(output).not.toContain(jwt);
    expect(output).not.toContain('owner@example.com');
  });
});

describe('web-p0-true-service-smoke lifecycle gate', () => {
  function createLifecycleDependencies() {
    return {
      run: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn().mockResolvedValue(undefined),
      verifyHygiene: jest.fn().mockResolvedValue(undefined),
      writeReport: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('only passes after run, cleanup, hygiene and report write all succeed', async () => {
    const dependencies = createLifecycleDependencies();

    await expect(runSmokeLifecycle(dependencies)).resolves.toBeUndefined();

    expect(dependencies.cleanup).toHaveBeenCalledTimes(1);
    expect(dependencies.verifyHygiene).toHaveBeenCalledTimes(1);
    expect(dependencies.writeReport).toHaveBeenCalledWith('passed', undefined);
  });

  it('cannot pass when cleanup fails', async () => {
    const dependencies = createLifecycleDependencies();
    dependencies.cleanup.mockRejectedValueOnce(new Error('cleanup unavailable'));

    await expect(runSmokeLifecycle(dependencies)).rejects.toThrow('cleanup: cleanup unavailable');
    expect(dependencies.verifyHygiene).toHaveBeenCalledTimes(1);
    expect(dependencies.writeReport).toHaveBeenCalledWith('failed', expect.any(Error));
  });

  it('cannot pass when post-run hygiene fails', async () => {
    const dependencies = createLifecycleDependencies();
    dependencies.verifyHygiene.mockRejectedValueOnce(new Error('active smoke account remains'));

    await expect(runSmokeLifecycle(dependencies)).rejects.toThrow(
      'post-run hygiene: active smoke account remains'
    );
    expect(dependencies.writeReport).toHaveBeenCalledWith('failed', expect.any(Error));
  });

  it('cannot pass when report write fails', async () => {
    const dependencies = createLifecycleDependencies();
    dependencies.writeReport.mockRejectedValueOnce(new Error('artifact disk unavailable'));

    await expect(runSmokeLifecycle(dependencies)).rejects.toThrow(
      'report write: artifact disk unavailable'
    );
  });
});

describe('web-p0-true-service-smoke product flow contract', () => {
  it('reads the registration code from the SMTP sink rather than auth storage', () => {
    expect(smokeSource).toContain('SMTP_SINK_API_URL');
    expect(smokeSource).toContain('/messages/latest?to=');
    expect(smokeSource).toContain('payload?.verificationCode');
    expect(smokeSource).not.toMatch(/prisma\.(?:authChallenge|emailVerification|verificationCode)/);
    expect(smokeSource).not.toMatch(/(?:verification_code|otp_code)\s*:/i);
  });

  it('exercises invite acceptance and exact two-party analysis consent', () => {
    expect(chatFlowSource).toContain('/chat/rooms/${roomId}/invites');
    expect(chatFlowSource).toContain('/chat/invites/${encodeURIComponent(chatInviteCode)}/accept');
    expect(chatFlowSource).toContain('selected_message_ids: [messageId]');
    expect(chatFlowSource).toContain('selected_capsule_ids: []');
    expect(chatFlowSource).toMatch(
      /const approvalARes[\s\S]*?headers: bearer\(userA\.token\)[\s\S]*?expectStatus\(approvalARes/
    );
    expect(chatFlowSource).toMatch(
      /const approvalBRes[\s\S]*?headers: bearer\(userB\.token\)[\s\S]*?expectStatus\(approvalBRes/
    );
    expect(chatFlowSource).toContain('/analysis-requests/${analysisRequestId}/decision');
    expect(chatFlowSource).toMatch(
      /const submitAnalysisRes[\s\S]*?\/analysis-requests\/\$\{analysisRequestId\}\/submit[\s\S]*?headers: bearer\(userA\.token\)/
    );
    expect(chatFlowSource).toContain('analysis_request_id: analysisRequestId');
    expect(smokeSource).not.toContain('included_message_ids');
  });
});
