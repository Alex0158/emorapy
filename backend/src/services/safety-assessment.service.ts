import type { Prisma } from '@prisma/client';
import prisma from '../config/database';
import {
  type JudgmentRoute,
  type SafetyAssessmentSnapshot,
  type SafetyRiskLevelForPolicy,
  buildSafetyAssessmentSnapshotForRoute,
  isJudgmentRoute,
} from '../utils/product-safety-policy';

export type SafetyAssessmentSubjectTypeForService =
  | 'user'
  | 'pairing'
  | 'case'
  | 'chat_room'
  | 'repair_track'
  | 'evidence';

export type SafetyAssessmentSourceForService =
  | 'evidence_assertion'
  | 'formal_case_assertion'
  | 'chat_judgment_policy'
  | 'judgment_route'
  | 'repair_policy'
  | 'system_audit'
  | 'admin_review';

export type SafetyAssessmentScope = {
  subjectType: SafetyAssessmentSubjectTypeForService;
  subjectId: string;
};

export type RecordSafetyAssessmentInput = SafetyAssessmentScope & {
  source: SafetyAssessmentSourceForService;
  snapshot: SafetyAssessmentSnapshot;
  assessedByUserId?: string | null;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown>;
  updateActiveRiskState?: boolean;
};

type SafetyAssessmentDbClient = typeof prisma;

type ActiveRelationshipRiskState = {
  id: string;
  scope_type: SafetyAssessmentSubjectTypeForService;
  scope_id: string;
  current_risk_level: SafetyRiskLevelForPolicy;
  judgment_route: string | null;
  can_invite_partner: boolean;
  can_use_co_repair: boolean;
  can_notify_partner: boolean;
  can_show_responsibility_ratio: boolean;
  force_solo_repair: boolean;
  source_assessment_id: string | null;
  reasons: string[];
  metadata: Prisma.JsonValue | null;
};

function mergeMetadata(
  snapshot: SafetyAssessmentSnapshot,
  extraMetadata?: Record<string, unknown>
): Prisma.InputJsonValue {
  return {
    ...snapshot.metadata,
    ...(extraMetadata || {}),
  } as Prisma.InputJsonValue;
}

function asMetadataObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function snapshotFromRiskState(
  state: ActiveRelationshipRiskState,
  fallbackRoute: JudgmentRoute
): SafetyAssessmentSnapshot {
  const route = isJudgmentRoute(state.judgment_route) ? state.judgment_route : fallbackRoute;
  return {
    risk_level: state.current_risk_level,
    judgment_route: route,
    can_invite_partner: state.can_invite_partner,
    can_use_co_repair: state.can_use_co_repair,
    can_notify_partner: state.can_notify_partner,
    can_show_responsibility_ratio: state.can_show_responsibility_ratio,
    force_solo_repair: state.force_solo_repair,
    reasons: state.reasons,
    metadata: {
      ...asMetadataObject(state.metadata),
      kind: 'relationship_risk_state_snapshot',
      version: 1,
      relationship_risk_state_id: state.id,
      source_assessment_id: state.source_assessment_id,
    },
  };
}

export class SafetyAssessmentService {
  constructor(private readonly db: SafetyAssessmentDbClient = prisma) {}

  async getActiveRiskState(scope: SafetyAssessmentScope): Promise<ActiveRelationshipRiskState | null> {
    return this.db.relationshipRiskState.findFirst({
      where: {
        scope_type: scope.subjectType,
        scope_id: scope.subjectId,
        is_active: true,
      },
      orderBy: {
        updated_at: 'desc',
      },
    }) as Promise<ActiveRelationshipRiskState | null>;
  }

  async getEffectiveRouteSnapshot(
    scope: SafetyAssessmentScope,
    fallbackRoute: JudgmentRoute,
    options: { fallbackReasons?: string[]; fallbackMetadata?: Record<string, unknown> } = {}
  ): Promise<{ source: 'active_risk_state' | 'fallback_route'; snapshot: SafetyAssessmentSnapshot }> {
    const activeState = await this.getActiveRiskState(scope);
    if (activeState) {
      return {
        source: 'active_risk_state',
        snapshot: snapshotFromRiskState(activeState, fallbackRoute),
      };
    }

    return {
      source: 'fallback_route',
      snapshot: buildSafetyAssessmentSnapshotForRoute(fallbackRoute, {
        reasons: options.fallbackReasons,
        metadata: options.fallbackMetadata,
      }),
    };
  }

  async recordAssessment(input: RecordSafetyAssessmentInput) {
    return this.db.$transaction(async (tx) => {
      const assessment = await tx.safetyAssessment.create({
        data: {
          subject_type: input.subjectType,
          subject_id: input.subjectId,
          source: input.source,
          risk_level: input.snapshot.risk_level,
          judgment_route: input.snapshot.judgment_route,
          can_invite_partner: input.snapshot.can_invite_partner,
          can_use_co_repair: input.snapshot.can_use_co_repair,
          can_notify_partner: input.snapshot.can_notify_partner,
          can_show_responsibility_ratio: input.snapshot.can_show_responsibility_ratio,
          force_solo_repair: input.snapshot.force_solo_repair,
          reasons: input.snapshot.reasons,
          metadata: mergeMetadata(input.snapshot, input.metadata),
          assessed_by_user_id: input.assessedByUserId ?? null,
          expires_at: input.expiresAt ?? null,
        },
      });

      if (input.updateActiveRiskState !== false) {
        await tx.relationshipRiskState.updateMany({
          where: {
            scope_type: input.subjectType,
            scope_id: input.subjectId,
            is_active: true,
          },
          data: {
            is_active: false,
          },
        });

        await tx.relationshipRiskState.create({
          data: {
            scope_type: input.subjectType,
            scope_id: input.subjectId,
            current_risk_level: input.snapshot.risk_level,
            judgment_route: input.snapshot.judgment_route,
            can_invite_partner: input.snapshot.can_invite_partner,
            can_use_co_repair: input.snapshot.can_use_co_repair,
            can_notify_partner: input.snapshot.can_notify_partner,
            can_show_responsibility_ratio: input.snapshot.can_show_responsibility_ratio,
            force_solo_repair: input.snapshot.force_solo_repair,
            source_assessment_id: assessment.id,
            reasons: input.snapshot.reasons,
            metadata: mergeMetadata(input.snapshot, input.metadata),
            is_active: true,
          },
        });
      }

      return assessment;
    });
  }

  async recordRouteAssessment(
    scope: SafetyAssessmentScope,
    route: JudgmentRoute,
    options: {
      source?: SafetyAssessmentSourceForService;
      reasons?: string[];
      metadata?: Record<string, unknown>;
      assessedByUserId?: string | null;
      updateActiveRiskState?: boolean;
    } = {}
  ) {
    return this.recordAssessment({
      ...scope,
      source: options.source ?? 'judgment_route',
      snapshot: buildSafetyAssessmentSnapshotForRoute(route, {
        reasons: options.reasons,
        metadata: options.metadata,
      }),
      assessedByUserId: options.assessedByUserId,
      metadata: options.metadata,
      updateActiveRiskState: options.updateActiveRiskState,
    });
  }
}

export const safetyAssessmentService = new SafetyAssessmentService();
