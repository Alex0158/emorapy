import fs from 'node:fs';
import path from 'node:path';
import { classifyLegacyChatMessage } from '../../../scripts/chat-channel-backfill-policy';
import { parseChatChannelBackfillArgs } from '../../../scripts/backfill-chat-context-channels';
import { parseLegacyPrivacyAuditArgs } from '../../../scripts/audit-private-context-legacy-data';

const backendRoot = path.resolve(__dirname, '../../..');
const migrationSql = fs.readFileSync(
  path.join(
    backendRoot,
    'prisma/migrations/20260712210000_add_chat_context_domain_foundation/migration.sql'
  ),
  'utf8'
);
const backfillSource = fs.readFileSync(
  path.join(backendRoot, 'scripts/backfill-chat-context-channels.ts'),
  'utf8'
);
const auditSource = fs.readFileSync(
  path.join(backendRoot, 'scripts/audit-private-context-legacy-data.ts'),
  'utf8'
);
const productionWorkflowSource = fs.readFileSync(
  path.resolve(backendRoot, '../.github/workflows/production-deploy-and-verify.yml'),
  'utf8'
);
const rootRailwayConfig = JSON.parse(
  fs.readFileSync(path.resolve(backendRoot, '../railway.json'), 'utf8')
) as {
  build?: {
    builder?: string;
  };
  deploy?: {
    preDeployCommand?: string[];
    healthcheckPath?: string;
    healthcheckTimeout?: number;
  };
};
const backendRailwayConfig = fs.readFileSync(path.join(backendRoot, 'railway.toml'), 'utf8');
const railwayWaitSource = fs.readFileSync(
  path.resolve(backendRoot, '../scripts/wait-railway-deploy.sh'),
  'utf8'
);
const canonicalChatContract = fs.readFileSync(
  path.resolve(backendRoot, '../packages/contracts/types/chat.d.ts'),
  'utf8'
);
const dockerChatContract = fs.readFileSync(
  path.join(backendRoot, 'src/types/contracts/chat.d.ts'),
  'utf8'
);
const packageJson = JSON.parse(fs.readFileSync(path.join(backendRoot, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

describe('chat context release migration tooling contract', () => {
  it('keeps expansion private-by-default and channel assignment explicit', () => {
    expect(migrationSql).toContain(
      'ADD COLUMN "private_context_use_mode" "PrivateContextUseMode" NOT NULL DEFAULT \'private_only\''
    );
    expect(migrationSql).toContain('ADD COLUMN "channel_id" TEXT');
    expect(migrationSql).toContain(
      'ADD COLUMN "ai_context_eligible" BOOLEAN NOT NULL DEFAULT false'
    );
    expect(parseChatChannelBackfillArgs([])).toMatchObject({ apply: false, dryRun: true });
  });

  it('does not auto-convert legacy summary text into a ContextCapsule', () => {
    const decision = classifyLegacyChatMessage({
      messageId: 'message-summary',
      roomId: 'room-1',
      roomExists: true,
      historyVisibilityMode: 'share_summary_only',
      visibilityScope: 'summary_only',
      messageType: 'user_text',
      createdAt: new Date('2026-07-12T00:00:00.000Z'),
      senderParticipantId: 'participant-a',
      senderParticipantRoomId: 'room-1',
      senderParticipantType: 'user',
      senderRoleInRoom: 'roleA',
      activeRoleBCandidateCount: 0,
      roleBJoinedAt: null,
      roleAPrivateOwnerParticipantId: 'participant-a',
      roleAPrivateOwnerCandidateCount: 1,
    });

    expect(decision).toMatchObject({
      target: 'private',
      legacyReviewRequired: true,
      capsuleAction: 'legacy_review_required_no_create',
      futureContextEligible: false,
    });
  });

  it('uses transaction batches and never selects chat message content', () => {
    expect(backfillSource).toContain('prisma.$transaction');
    expect(backfillSource).toContain('WHERE m.channel_id IS NULL');
    expect(backfillSource).not.toMatch(/m\.content\b/);
  });

  it('keeps the backend-only Railway Docker context aligned with canonical chat types', () => {
    expect(dockerChatContract.trimEnd()).toBe(canonicalChatContract.trimEnd());
  });

  it('keeps the ProfileSnapshot audit read-only and exposes package entrypoints', () => {
    expect(parseLegacyPrivacyAuditArgs([]).readOnly).toBe(true);
    expect(() => parseLegacyPrivacyAuditArgs(['--apply'])).toThrow();
    expect(auditSource).not.toMatch(
      /(?:prisma|tx)\.[A-Za-z]+\.(?:create|createMany|update|updateMany|delete|deleteMany|upsert)\s*\(/
    );
    expect(packageJson.scripts['ops:chat-context:backfill']).toBe(
      'tsx scripts/backfill-chat-context-channels.ts'
    );
    expect(packageJson.scripts['ops:chat-context:backfill:apply']).toContain('--apply');
    expect(packageJson.scripts['ops:chat-context:legacy-audit']).toBe(
      'tsx scripts/audit-private-context-legacy-data.ts'
    );
  });

  it('keeps production deploy gated by exact CI and exact backend readiness', () => {
    expect(productionWorkflowSource).toContain('shell: bash');
    expect(productionWorkflowSource).toContain(
      'Production deployment is restricted to refs/heads/main'
    );
    expect(productionWorkflowSource).toContain('permissions:\n  actions: read\n  contents: read');
    expect(productionWorkflowSource).toContain(
      'Require successful CI for exact production SHA'
    );
    expect(productionWorkflowSource).toContain(
      'repos/${GITHUB_REPOSITORY}/actions/workflows/ci.yml/runs'
    );
    expect(productionWorkflowSource).toContain('.head_sha == $sha');
    expect(productionWorkflowSource).toContain('.conclusion == "success"');
    expect(productionWorkflowSource).toContain(
      'Production Deploy and Verify requires the release gate'
    );
    expect(productionWorkflowSource).toContain(
      'Production Deploy and Verify requires both web and backend targets'
    );
    expect(productionWorkflowSource).toContain(
      ".data.commitSha // .commitSha // empty"
    );
    expect(productionWorkflowSource).toContain(
      '(.data.database.releaseMigrations // .database.releaseMigrations) == "ready"'
    );
    expect(productionWorkflowSource).toContain(
      'EXPECTED_DEPLOYMENT_ID: ${{ steps.railway_deploy.outputs.value }}'
    );
    expect(productionWorkflowSource).toContain(
      '.data.deploymentId // .deploymentId // empty'
    );
    expect(productionWorkflowSource).toContain(
      'temp/chat-context-release/railway-deployment.json'
    );
    expect(productionWorkflowSource.match(/git rev-parse origin\/main/g)).toHaveLength(4);
    expect(productionWorkflowSource).toContain('railway up --detach --json');
    expect(productionWorkflowSource).toContain(
      `deployment_id="$(jq -er '.deploymentId' temp/chat-context-release/railway-up.json)"`
    );
    expect(productionWorkflowSource).not.toContain('Build Logs');
    expect(productionWorkflowSource).toContain(
      '(.meta.serviceManifest.build.builder | ascii_downcase) == "dockerfile"'
    );
    expect(productionWorkflowSource).toContain(
      '.meta.serviceManifest.build.dockerfilePath'
    );
    expect(productionWorkflowSource).toContain('ltrimstr("/")');
    expect(productionWorkflowSource).toContain('. == "backend/Dockerfile"');
    expect(railwayWaitSource).toContain('railway deployment list');
    expect(railwayWaitSource).toContain('select(.id == $deployment_id)');
    expect(productionWorkflowSource).toContain('railway link \\');
    expect(productionWorkflowSource).not.toContain('RAILWAY_API_TOKEN=${LEGACY_RAILWAY_TOKEN}');

    const ciVerification = productionWorkflowSource.indexOf(
      'Require successful CI for exact production SHA'
    );
    const railwayDeploy = productionWorkflowSource.indexOf(
      'Trigger Railway production deploy'
    );
    const backendVerification = productionWorkflowSource.indexOf(
      'Verify exact backend and runtime database release'
    );
    expect(ciVerification).toBeGreaterThan(-1);
    expect(railwayDeploy).toBeGreaterThan(ciVerification);
    expect(backendVerification).toBeGreaterThan(railwayDeploy);
    const backendDeployJob = productionWorkflowSource.slice(
      productionWorkflowSource.indexOf('  deploy-backend:'),
      productionWorkflowSource.indexOf('  verify-release:')
    );
    expect(backendDeployJob).not.toContain('PRODUCTION_DATABASE_URL');
  });

  it('runs migration/backfill/audit in the Railway runtime DB before readiness traffic switch', () => {
    expect(rootRailwayConfig.deploy).toMatchObject({
      healthcheckPath: '/health/ready',
      healthcheckTimeout: 300,
    });
    expect(rootRailwayConfig.deploy?.preDeployCommand).toHaveLength(1);
    expect(rootRailwayConfig.deploy?.preDeployCommand?.[0]).toContain(
      'npm run ops:production:predeploy'
    );
    const preDeploy = packageJson.scripts['ops:production:predeploy'] ?? '';
    expect(preDeploy).toContain('prisma migrate deploy');
    expect(preDeploy).toContain('ops:chat-context:backfill -- --dry-run --target=production');
    expect(preDeploy).toContain('--apply --target=production --confirm-production');
    expect(preDeploy).toContain('ops:chat-context:legacy-audit -- --target=production');
    expect(backendRailwayConfig).toContain('healthcheckPath = "/health/ready"');
    expect(backendRailwayConfig).toContain('healthcheckTimeout = 300');
    expect(backendRailwayConfig).toContain('builder = "DOCKERFILE"');
    expect(backendRailwayConfig).toContain('dockerfilePath = "Dockerfile"');
    expect(productionWorkflowSource).not.toContain(
      "jq -er '.commitSha // empty'"
    );
  });
});
