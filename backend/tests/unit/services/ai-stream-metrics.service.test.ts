import { describe, expect, it } from '@jest/globals';
import { aiStreamMetricsService } from '../../../src/services/ai-stream-metrics.service';

describe('AIStreamMetricsService', () => {
  it('應輸出 AI stream 相關 Prometheus 指標', async () => {
    aiStreamMetricsService.recordEvent('chat_room', 'stream.created');
    aiStreamMetricsService.recordEvent('chat_room', 'stream.delta');
    aiStreamMetricsService.recordTerminal('chat_room', 'persisted');
    aiStreamMetricsService.observeFirstDelta('chat_room', 120);
    aiStreamMetricsService.observeCompleteToPersist('chat_room', 35);

    const metrics = await aiStreamMetricsService.exportPrometheus();

    expect(metrics).toContain('ai_stream_events_total');
    expect(metrics).toContain('ai_stream_terminal_total');
    expect(metrics).toContain('ai_stream_time_to_first_delta_ms');
    expect(metrics).toContain('ai_stream_complete_to_persist_ms');
  });
});
