/**
 * Judgment normalization service tests
 */

const mockGetActiveRiskState = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('../../../src/services/safety-assessment.service', () => ({
  __esModule: true,
  safetyAssessmentService: {
    getActiveRiskState: (...args: unknown[]) => mockGetActiveRiskState(...args),
  },
}));

jest.mock('../../../src/config/logger', () => ({
  __esModule: true,
  default: {
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
  },
}));

import { normalizeJudgmentWithSafetyState } from '../../../src/services/judgment-normalization.service';

describe('normalizeJudgmentWithSafetyState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActiveRiskState.mockResolvedValue(null);
  });

  it('應在沒有 active safety state 時保留 stored route visibility', async () => {
    const result = await normalizeJudgmentWithSafetyState({
      id: 'j1',
      case_id: 'case-1',
      plaintiff_ratio: 60,
      defendant_ratio: 40,
      emotional_analysis: { route: 'standard' },
    });

    expect(mockGetActiveRiskState).toHaveBeenCalledWith({
      subjectType: 'case',
      subjectId: 'case-1',
    });
    expect(result).toMatchObject({
      judgment_route: 'standard',
      responsibility_ratio_visibility: { can_show: true, reason: null },
    });
  });

  it('應以 case active safety state 覆蓋責任比例可見性', async () => {
    mockGetActiveRiskState.mockResolvedValueOnce({
      id: 'state-1',
      judgment_route: 'safety_support',
      can_show_responsibility_ratio: false,
      reasons: ['active case risk'],
    });

    const result = await normalizeJudgmentWithSafetyState({
      id: 'j1',
      case_id: 'case-1',
      plaintiff_ratio: 50,
      defendant_ratio: 50,
      emotional_analysis: { route: 'standard' },
    });

    expect(result).toMatchObject({
      judgment_route: 'safety_support',
      responsibility_ratio_visibility: {
        can_show: false,
        reason: '安全支持路由不得展示責任比例，避免把安全風險對稱化',
      },
    });
  });

  it('lookup 失敗時應回退到 stored route 並記錄警告', async () => {
    mockGetActiveRiskState.mockRejectedValueOnce(new Error('db unavailable'));

    const result = await normalizeJudgmentWithSafetyState({
      id: 'j1',
      case_id: 'case-1',
      plaintiff_ratio: 50,
      defendant_ratio: 50,
      emotional_analysis: { route: 'standard' },
    });

    expect(result).toMatchObject({
      judgment_route: 'standard',
      responsibility_ratio_visibility: { can_show: true, reason: null },
    });
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Judgment safety state lookup failed, fallback to stored route visibility',
      expect.objectContaining({ judgmentId: 'j1', caseId: 'case-1' })
    );
  });
});
