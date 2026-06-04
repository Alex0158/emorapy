const React = require('react');
const { act, fireEvent, render, waitFor } = require('@testing-library/react-native');
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
const { setLocale } = require('@/src/i18n');

let mockLifecycleStatus = 'active';
let mockLifecycleListener = null;
const mockSubscribeLifecycle = jest.fn((listener) => {
  mockLifecycleListener = listener;
  return jest.fn();
});
const mockGetToken = jest.fn();
const mockGetPairingStatus = jest.fn();
const mockCreatePairing = jest.fn();
const mockJoinPairing = jest.fn();
const mockCancelPairing = jest.fn();
const mockListCases = jest.fn();
const mockCreateCase = jest.fn();
const mockSubmitCase = jest.fn();
const mockGenerateJudgment = jest.fn();
const mockAcceptJudgment = jest.fn();
const mockGetDashboard = jest.fn();
const mockGetPlans = jest.fn();
const mockGeneratePlans = jest.fn();
const mockSelectPlan = jest.fn();
const mockConfirmExecution = jest.fn();
const mockCheckin = jest.fn();
const mockReplanTrack = jest.fn();
const mockConnectRepairTrackStream = jest.fn();
const mockUploadEvidence = jest.fn();
const mockPickImage = jest.fn();
const mockCreateEvidenceUploadFormData = jest.fn();
const mockCaptureTelemetry = jest.fn();
const mockRouterPush = jest.fn();
let mockSearchParams = {};

jest.mock('expo-router', () => ({
  router: {
    push: mockRouterPush,
  },
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('@/src/features/m4/api', () => ({
  connectRepairTrackStream: mockConnectRepairTrackStream,
  normalizeM4Error: (error) => ({ message: error?.message || '請稍後再試。' }),
  m4Api: {
    cases: {
      create: mockCreateCase,
      list: mockListCases,
      submit: mockSubmitCase,
    },
    execution: {
      checkin: mockCheckin,
      confirm: mockConfirmExecution,
      getDashboard: mockGetDashboard,
      replanTrack: mockReplanTrack,
    },
    judgment: {
      accept: mockAcceptJudgment,
      generate: mockGenerateJudgment,
    },
    pairing: {
      cancel: mockCancelPairing,
      create: mockCreatePairing,
      getStatus: mockGetPairingStatus,
      join: mockJoinPairing,
    },
    reconciliation: {
      generatePlans: mockGeneratePlans,
      getPlans: mockGetPlans,
      selectPlan: mockSelectPlan,
    },
  },
}));

jest.mock('@/src/features/m5/api', () => ({
  normalizeM5Error: (error) => ({ code: error?.code || 'APP_ERROR', message: error?.message || '請稍後再試。' }),
  m5Api: {
    media: {
      uploadEvidence: mockUploadEvidence,
    },
  },
}));

jest.mock('@/src/platform/upload/native', () => ({
  createEvidenceUploadFormData: mockCreateEvidenceUploadFormData,
  pickImage: mockPickImage,
}));

jest.mock('@/src/platform/storage/secureStore', () => ({
  tokenStorage: {
    getToken: mockGetToken,
  },
}));

jest.mock('@/src/platform/telemetry/client', () => ({
  captureTelemetry: mockCaptureTelemetry,
}));

jest.mock('@/src/platform/lifecycle/native', () => ({
  getCurrentLifecycleStatus: () => mockLifecycleStatus,
  subscribeLifecycle: (listener) => mockSubscribeLifecycle(listener),
}));

const CaseScreen = require('../app/(app)/case/index').default;
const RepairScreen = require('../app/(app)/repair/index').default;

const queryClients = [];

function renderWithQuery(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: Infinity, retry: false },
      queries: { gcTime: Infinity, retry: false },
    },
  });
  queryClients.push(queryClient);
  return render(React.createElement(QueryClientProvider, { client: queryClient }, ui));
}

describe('M4 Case/Repair screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setLocale('zh-TW', { persist: false });
    mockSearchParams = {};
    mockLifecycleStatus = 'active';
    mockLifecycleListener = null;
    mockSubscribeLifecycle.mockClear();
    mockGetToken.mockResolvedValue('jwt-token');
    mockGetPairingStatus.mockResolvedValue({
      id: 'pair-1',
      invite_code: 'PAIR01',
      status: 'active',
      pairing_type: 'normal',
      created_at: '2026-05-08T00:00:00.000Z',
    });
    mockCreatePairing.mockResolvedValue({ id: 'pair-2', invite_code: 'PAIR02', status: 'pending' });
    mockJoinPairing.mockResolvedValue({ id: 'pair-3', status: 'active' });
    mockCancelPairing.mockResolvedValue({ id: 'pair-1', status: 'cancelled' });
    mockListCases.mockResolvedValue({
      cases: [
        {
          id: 'case-1',
          pairing_id: 'pair-1',
          title: '正式案件',
          type: '其他衝突',
          plaintiff_statement: 'statement',
          status: 'draft',
          mode: 'remote',
          created_at: '2026-05-08T00:00:00.000Z',
          updated_at: '2026-05-08T00:00:00.000Z',
        },
      ],
      pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
    });
    mockCreateCase.mockResolvedValue({ id: 'case-2' });
    mockSubmitCase.mockResolvedValue({ id: 'case-1', status: 'submitted' });
    mockGenerateJudgment.mockResolvedValue({
      id: 'judgment-1',
      case_id: 'case-1',
      judgment_content: '判斷內容',
      plaintiff_ratio: 60,
      defendant_ratio: 40,
      ai_model: 'mock',
    });
    mockAcceptJudgment.mockResolvedValue({ id: 'judgment-1', user1_acceptance: true });
    mockGetDashboard.mockResolvedValue([]);
    mockGetPlans.mockResolvedValue({ plans: [], recommended_plan_id: null, intent: 'repair' });
    mockGeneratePlans.mockResolvedValue({
      plans: [{ id: 'plan-1', plan_type: 'activity', difficulty_level: 'easy' }],
      recommended_plan_id: 'plan-1',
      intent: 'repair',
    });
    mockSelectPlan.mockResolvedValue({ id: 'plan-1' });
    mockConfirmExecution.mockResolvedValue({ id: 'execution-1' });
    mockCheckin.mockResolvedValue({ id: 'execution-2' });
    mockReplanTrack.mockResolvedValue({
      track_id: 'track-1',
      status: 'replanning',
      accepted: true,
      stream_scope: 'repair_track',
      scope_id: 'track-1',
      stream_id: 'stream-1',
      request_id: 'req-1',
    });
    mockConnectRepairTrackStream.mockImplementation(() => new Promise(() => {}));
    mockPickImage.mockResolvedValue({ uri: 'file://evidence.jpg', fileName: 'evidence.jpg', mimeType: 'image/jpeg' });
    mockCreateEvidenceUploadFormData.mockReturnValue({ marker: 'form-data' });
    mockUploadEvidence.mockResolvedValue([{ id: 'evidence-1' }]);
  });

  afterEach(() => {
    while (queryClients.length) {
      queryClients.pop().clear();
    }
  });

  it('creates a formal case under the current pairing', async () => {
    const screen = renderWithQuery(React.createElement(CaseScreen));

    expect(screen.getAllByText('正式案件').length).toBeGreaterThan(0);
    expect(screen.queryByText('CASE')).toBeNull();
    expect(await screen.findByText('PAIR01')).toBeTruthy();
    expect(await screen.findByText('草稿')).toBeTruthy();
    expect(screen.queryByText('draft')).toBeNull();
    expect(screen.getByTestId('case.item.case-1.created-at').props.children).toBe('建立於 2026/5/8');
    expect(screen.queryByText('2026-05-08T00:00:00.000Z')).toBeNull();
    expect(screen.queryByText('case-1')).toBeNull();
    fireEvent.changeText(
      screen.getByPlaceholderText(/先寫清楚你這邊/),
      '這是一段足夠長的正式案件陳述，用來描述具體事件、影響和希望被理解的點。'
    );
    fireEvent.press(screen.getByText('建立正式案件'));

    await waitFor(() => expect(mockCreateCase).toHaveBeenCalledTimes(1));
    expect(mockCreateCase).toHaveBeenCalledWith(expect.objectContaining({
      pairing_id: 'pair-1',
      mode: 'remote',
    }));
  });

  it('renders formal case chrome in English when selected', async () => {
    setLocale('en-US', { persist: false });

    const screen = renderWithQuery(React.createElement(CaseScreen));

    expect(await screen.findByText('PAIR01')).toBeTruthy();
    expect(screen.getAllByText('Formal case').length).toBeGreaterThan(0);
    expect(screen.getByText('From partner linking and formal cases to analysis results.')).toBeTruthy();
    expect(screen.getByText('Partner link')).toBeTruthy();
    expect(screen.getByText('Partner link created')).toBeTruthy();
    expect(screen.getByText('Create partner access')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter access code')).toBeTruthy();
    expect(screen.getByText('Create case')).toBeTruthy();
    expect(screen.getByPlaceholderText('Write your concrete events, impact, and what you hope can be understood.')).toBeTruthy();
    expect(screen.getByText('Evidence safety check')).toBeTruthy();
    expect(screen.getByText('Case list')).toBeTruthy();
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(screen.getByTestId('case.item.case-1.created-at').props.children).toMatch(/^Created on /);
    expect(screen.getByText('Submit case')).toBeTruthy();
    expect(screen.getByText('Upload evidence')).toBeTruthy();
    expect(screen.getByText('Generate / retry analysis')).toBeTruthy();
    expect(screen.queryByText('生成 / 重試判斷')).toBeNull();
  });

  it('keeps formal case creation disabled until pairing and statement are ready', async () => {
    const screen = renderWithQuery(React.createElement(CaseScreen));

    expect(screen.queryByText('Quick 可匿名')).toBeNull();
    expect(await screen.findByText('PAIR01')).toBeTruthy();
    expect(screen.getByTestId('case.create-case').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('case.invite-code.helper').props.children).toBe('輸入對方提供的配對邀請碼。');
    expect(screen.getByTestId('case.plaintiff-statement.helper').props.children).toContain('再補 30 個字');
    expect(screen.getByTestId('case.defendant-statement.helper').props.children).toBe('可選填，先留空也能建立案件。');

    fireEvent.changeText(screen.getByTestId('case.invite-code.input'), 'PAIR02');
    expect(screen.getByTestId('case.invite-code.helper').props.children).toBe('可以嘗試加入配對。');

    fireEvent.changeText(screen.getByPlaceholderText(/先寫清楚你這邊/), '太短');
    expect(screen.getByTestId('case.create-case').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(
      screen.getByPlaceholderText(/先寫清楚你這邊/),
      '這是一段足夠長的正式案件陳述，用來描述具體事件、影響和希望被理解的點。'
    );
    fireEvent.changeText(screen.getByPlaceholderText(/可選：補上對方可能的說法/), '補上對方可能視角。');

    expect(screen.getByTestId('case.plaintiff-statement.helper').props.children).toContain('/1200');
    expect(screen.getByTestId('case.defendant-statement.helper').props.children).toContain('/1200');
    expect(screen.getByTestId('case.create-case').props.accessibilityState.disabled).toBe(false);
  });

  it('shows a safe fallback when a case created time is missing', async () => {
    mockListCases.mockResolvedValueOnce({
      cases: [
        {
          id: 'case-missing-created-at',
          pairing_id: 'pair-1',
          title: '待同步案件',
          type: '其他衝突',
          plaintiff_statement: 'statement',
          status: 'draft',
          mode: 'remote',
          created_at: null,
          updated_at: '2026-05-08T00:00:00.000Z',
        },
      ],
      pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
    });

    const screen = renderWithQuery(React.createElement(CaseScreen));

    expect(await screen.findByText('待同步案件')).toBeTruthy();
    expect(screen.getByTestId('case.item.case-missing-created-at.created-at').props.children)
      .toBe('建立時間待同步');
  });

  it('accepts a judgment and opens repair with the judgment context', async () => {
    const screen = renderWithQuery(React.createElement(CaseScreen));

    const generateButton = await screen.findByTestId('case.item.case-1.generate-judgment');
    fireEvent.press(generateButton);

    expect(await screen.findByText('判斷內容')).toBeTruthy();
    fireEvent.press(screen.getByText('接受梳理結果並進入修復'));

    await waitFor(() => expect(mockAcceptJudgment).toHaveBeenCalledWith('judgment-1', {
      accepted: true,
      rating: 5,
    }));
    expect(mockRouterPush).toHaveBeenCalledWith('/repair?judgmentId=judgment-1');
  });

  it('generates repair plans and records a checkin', async () => {
    mockSearchParams = { judgmentId: 'judgment-1' };
    const screen = renderWithQuery(React.createElement(RepairScreen));

    expect(screen.getAllByText('修復').length).toBeGreaterThan(0);
    expect(screen.queryByText('REPAIR')).toBeNull();
    expect(await screen.findByText('已從案件帶入，可以直接生成修復方案。')).toBeTruthy();
    expect(screen.queryByPlaceholderText('輸入判斷代號')).toBeNull();
    fireEvent.press(screen.getByText('生成方案'));

    await waitFor(() => expect(mockGeneratePlans).toHaveBeenCalledWith('judgment-1', { intent: 'repair' }));
    expect(await screen.findByText('一起做一件小事')).toBeTruthy();
    expect(screen.queryByText('activity')).toBeNull();
    expect(screen.getByText('方案狀態')).toBeTruthy();
    expect(screen.getByText('目前選擇')).toBeTruthy();
    expect(screen.queryByText('方案代號')).toBeNull();
    expect(screen.getByText('已選擇修復方案。')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText(/今天做了什麼/), '完成了第一步');
    expect(screen.getByTestId('repair.checkin-notes.helper').props.children).toContain('/600');
    fireEvent.press(screen.getByText('完成今日一步'));

    await waitFor(() => expect(mockCheckin).toHaveBeenCalledTimes(1));
    expect(mockCheckin).toHaveBeenCalledWith(expect.objectContaining({
      plan_id: 'plan-1',
      notes: '完成了第一步',
      step_result: 'done',
    }));
  });

  it('renders repair chrome in English when selected', async () => {
    setLocale('en-US', { persist: false });
    mockSearchParams = { judgmentId: 'judgment-1' };

    const screen = renderWithQuery(React.createElement(RepairScreen));

    expect(await screen.findByText('Repair path')).toBeTruthy();
    expect(screen.getByText('Turn the analysis into small steps both sides can actually do.')).toBeTruthy();
    expect(screen.getByText('Path board')).toBeTruthy();
    expect(screen.getByText('0 path(s)')).toBeTruthy();
    expect(screen.getByText('No repair paths yet.')).toBeTruthy();
    expect(screen.getByText('Options')).toBeTruthy();
    expect(screen.getByText('Analysis source')).toBeTruthy();
    expect(screen.getByText('Brought in from the case. You can generate repair options directly.')).toBeTruthy();
    expect(screen.getByText('Load options')).toBeTruthy();
    expect(screen.getByText('Generate options')).toBeTruthy();
    expect(screen.getByText('Adjust')).toBeTruthy();
    expect(screen.getByText('Adjustment status')).toBeTruthy();
    expect(screen.getByText('Select a repair path from the board first.')).toBeTruthy();
    expect(screen.getByText('Lower pressure first')).toBeTruthy();
    expect(screen.getByText('Need help')).toBeTruthy();
    expect(screen.getByText('Adjust this round')).toBeTruthy();
    expect(screen.getByText('Execution')).toBeTruthy();
    expect(screen.getByText('Current option')).toBeTruthy();
    expect(screen.getByText('Select an option above first.')).toBeTruthy();
    expect(screen.getByPlaceholderText('What did you do today, or where are you stuck?')).toBeTruthy();
    expect(screen.getByText('Back to case')).toBeTruthy();
    expect(screen.queryByText('生成方案')).toBeNull();
  });

  it('starts repair replan and renders repair_track stream replay', async () => {
    mockGetDashboard.mockResolvedValue([
      {
        plan_id: 'plan-1',
        track_id: 'track-1',
        status: 'in_progress',
        journey_status: 'solo_active',
        relationship_mode: 'solo',
        records: [],
        recent_checkins: [],
        progress: 0.2,
        plan_summary: {
          title: '修復計畫',
          plan_type: 'activity',
          difficulty_level: 'easy',
        },
        current_step: {
          content: '先傳一則訊息',
          step_index: 0,
          title: 'today',
        },
      },
    ]);
    mockConnectRepairTrackStream.mockImplementationOnce((trackId, callbacks, options) => {
      expect(trackId).toBe('track-1');
      expect(options.afterSeq).toBeUndefined();
      setTimeout(() => {
        callbacks.onReady?.({
          scopeType: 'repair_track',
          scopeId: 'track-1',
          snapshots: [
            {
              streamId: 'stream-1',
              requestId: 'req-1',
              scopeType: 'repair_track',
              scopeId: 'track-1',
              status: 'streaming',
              text: '先降低壓力',
              phase: 'drafting',
              lastSeq: 2,
              updatedAt: '2026-05-08T00:00:00.000Z',
              metadata: { task_type: 'repair_replan' },
            },
          ],
        });
        callbacks.onEvent?.({
          eventType: 'stream.delta',
          streamId: 'stream-1',
          requestId: 'req-1',
          scopeType: 'repair_track',
          scopeId: 'track-1',
          seq: 3,
          createdAt: '2026-05-08T00:00:01.000Z',
          deltaText: '，把今天的任務改短',
          metadata: { task_type: 'repair_replan' },
        });
        callbacks.onEvent?.({
          eventType: 'stream.persisted',
          streamId: 'stream-1',
          requestId: 'req-1',
          scopeType: 'repair_track',
          scopeId: 'track-1',
          seq: 4,
          createdAt: '2026-05-08T00:00:02.000Z',
          fullText: '重調完成。',
          phase: 'persisted',
          metadata: { task_type: 'repair_replan', plan_id: 'plan-2' },
        });
      }, 0);
      return new Promise(() => {});
    });

    const screen = renderWithQuery(React.createElement(RepairScreen));

    expect(await screen.findByText('修復計畫')).toBeTruthy();
    expect(screen.queryByText('旅程識別碼')).toBeNull();
    expect(screen.queryByText('track-1')).toBeNull();
    expect(screen.queryByPlaceholderText('輸入修復旅程識別碼')).toBeNull();
    fireEvent.press(screen.getByText('選這條重新調整'));
    expect(screen.getByText('已選擇一條修復旅程。')).toBeTruthy();
    fireEvent.press(screen.getByText('重新調整這一輪'));

    await waitFor(() => expect(mockReplanTrack).toHaveBeenCalledWith('track-1', {
      mode: 'lower_pressure',
      reason: 'manual',
    }));
    expect(await screen.findByText('重調完成。')).toBeTruthy();
    expect(screen.getByText('已準備好，可在下方開始執行。')).toBeTruthy();
    expect(screen.queryByText('plan-2')).toBeNull();
    await waitFor(() => expect(mockGetDashboard.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it('does not expose raw repair replan stream errors in the selected locale', async () => {
    setLocale('en-US', { persist: false });
    mockSearchParams = { trackId: 'track-error' };
    mockGetDashboard.mockResolvedValue([]);
    mockConnectRepairTrackStream.mockImplementationOnce((_trackId, callbacks) => {
      callbacks.onEvent?.({
        eventType: 'stream.failed',
        streamId: 'stream-error',
        requestId: 'req-error',
        scopeType: 'repair_track',
        scopeId: 'track-error',
        seq: 2,
        createdAt: '2026-05-08T00:00:01.000Z',
        error: { code: 'APP_ERROR', message: 'provider down' },
        metadata: { task_type: 'repair_replan' },
      });
      return new Promise(() => {});
    });

    const screen = renderWithQuery(React.createElement(RepairScreen));

    expect(await screen.findByText('The stream update was interrupted. Try again later.')).toBeTruthy();
    expect(screen.queryByText('provider down')).toBeNull();
  });

  it('recovers repair replan stream from last seq after app foregrounds', async () => {
    const connections = [];
    mockGetDashboard.mockResolvedValue([
      {
        plan_id: 'plan-1',
        track_id: 'track-recover',
        status: 'in_progress',
        journey_status: 'solo_active',
        relationship_mode: 'solo',
        records: [],
        recent_checkins: [],
        progress: 0.2,
        plan_summary: {
          title: '修復計畫',
          plan_type: 'activity',
          difficulty_level: 'easy',
        },
        current_step: {
          content: '先傳一則訊息',
          step_index: 0,
          title: 'today',
        },
      },
    ]);
    mockConnectRepairTrackStream.mockImplementation((trackId, callbacks, options) => {
      connections.push({ trackId, callbacks, options });
      return new Promise(() => undefined);
    });

    const screen = renderWithQuery(React.createElement(RepairScreen));

    expect(await screen.findByText('修復計畫')).toBeTruthy();
    fireEvent.press(screen.getByText('選這條重新調整'));

    await waitFor(() => expect(mockConnectRepairTrackStream).toHaveBeenCalledTimes(1));
    expect(connections[0].trackId).toBe('track-recover');
    expect(connections[0].options.afterSeq).toBeUndefined();

    act(() => {
      connections[0].callbacks.onReady({
        scopeType: 'repair_track',
        scopeId: 'track-recover',
        snapshots: [{
          streamId: 'stream-recover',
          requestId: 'req-recover',
          scopeType: 'repair_track',
          scopeId: 'track-recover',
          status: 'streaming',
          text: '先降低壓力',
          phase: 'drafting',
          lastSeq: 2,
          updatedAt: '2026-05-08T00:00:00.000Z',
          metadata: { task_type: 'repair_replan' },
        }],
      });
    });
    expect(await screen.findByText('先降低壓力')).toBeTruthy();

    act(() => {
      mockLifecycleStatus = 'background';
      mockLifecycleListener('background');
    });

    await waitFor(() => expect(connections[0].options.signal.aborted).toBe(true));
    expect(await screen.findByText(/恢復連線中 \/ 正在改寫方案 \/ App 在背景/)).toBeTruthy();

    act(() => {
      mockLifecycleStatus = 'active';
      mockLifecycleListener('active');
    });

    await waitFor(() => expect(mockConnectRepairTrackStream).toHaveBeenCalledTimes(2));
    expect(connections[1].trackId).toBe('track-recover');
    expect(connections[1].options.afterSeq).toBe(2);

    act(() => {
      connections[1].callbacks.onEvent({
        eventType: 'stream.delta',
        streamId: 'stream-recover',
        requestId: 'req-recover',
        scopeType: 'repair_track',
        scopeId: 'track-recover',
        seq: 3,
        createdAt: '2026-05-08T00:00:01.000Z',
        deltaText: '，把今天的任務改短',
        phase: 'drafting',
        metadata: { task_type: 'repair_replan' },
      });
    });

    expect(await screen.findByText('先降低壓力，把今天的任務改短')).toBeTruthy();
  });

  it('uploads evidence through the M5 upload adapter for draft cases', async () => {
    const screen = renderWithQuery(React.createElement(CaseScreen));

    expect(await screen.findByText('PAIR01')).toBeTruthy();
    expect(screen.getByTestId('case.item.case-1.upload-evidence').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('case.evidence-safety.no-blocked.toggle'));
    expect(screen.getByTestId('case.item.case-1.upload-evidence').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(screen.getByTestId('case.item.case-1.upload-evidence'));

    await waitFor(() => expect(mockPickImage).toHaveBeenCalledWith({ allowsEditing: false, quality: 0.82 }));
    expect(mockCreateEvidenceUploadFormData).toHaveBeenCalledWith(
      [{ uri: 'file://evidence.jpg', fileName: 'evidence.jpg', mimeType: 'image/jpeg' }],
      {
        safetyAssertion: {
          contains_illegal_content: false,
          contains_minor: false,
          contains_nonconsensual_content: false,
          contains_sensitive_content: false,
          minor_guardian_or_self_upload_confirmed: false,
          sensitive_content_handling_ack: false,
        },
      }
    );
    expect(mockUploadEvidence).toHaveBeenCalledWith('case-1', { marker: 'form-data' });
    await waitFor(() => expect(mockCaptureTelemetry).toHaveBeenCalledWith(expect.objectContaining({
      name: 'case_evidence_upload_success',
    })));
    expect(await screen.findByText('已上傳 1 份證據。')).toBeTruthy();
  });

  it('requires explicit sensitive evidence acknowledgement before upload', async () => {
    const screen = renderWithQuery(React.createElement(CaseScreen));

    expect(await screen.findByText('PAIR01')).toBeTruthy();
    fireEvent.press(screen.getByTestId('case.evidence-safety.no-blocked.toggle'));
    fireEvent.press(screen.getByTestId('case.evidence-safety.contains-sensitive.toggle'));

    expect(screen.getByTestId('case.item.case-1.upload-evidence').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('case.evidence-safety.sensitive-ack.toggle'));
    fireEvent.press(screen.getByTestId('case.item.case-1.upload-evidence'));

    await waitFor(() => expect(mockUploadEvidence).toHaveBeenCalledTimes(1));
    expect(mockCreateEvidenceUploadFormData).toHaveBeenCalledWith(
      [{ uri: 'file://evidence.jpg', fileName: 'evidence.jpg', mimeType: 'image/jpeg' }],
      {
        safetyAssertion: expect.objectContaining({
          contains_sensitive_content: true,
          sensitive_content_handling_ack: true,
        }),
      }
    );
  });

  it('does not treat a cancelled evidence picker as a successful upload', async () => {
    mockPickImage.mockResolvedValueOnce(null);
    const screen = renderWithQuery(React.createElement(CaseScreen));

    expect(await screen.findByText('PAIR01')).toBeTruthy();
    fireEvent.press(screen.getByTestId('case.evidence-safety.no-blocked.toggle'));
    fireEvent.press(screen.getByTestId('case.item.case-1.upload-evidence'));

    await waitFor(() => expect(mockPickImage).toHaveBeenCalledTimes(1));
    expect(mockUploadEvidence).not.toHaveBeenCalled();
    expect(mockCaptureTelemetry).not.toHaveBeenCalledWith(expect.objectContaining({
      name: 'case_evidence_upload_success',
    }));
    expect(await screen.findByText('未選擇檔案。')).toBeTruthy();
  });
});
