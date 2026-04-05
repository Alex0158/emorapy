import client, { Counter, Histogram, Registry } from 'prom-client';

class AIStreamMetricsService {
  private registry: Registry;
  private cEvents: Counter<string>;
  private cStreams: Counter<string>;
  private hFirstDeltaMs: Histogram<string>;
  private hCompleteToPersistMs: Histogram<string>;

  constructor() {
    this.registry = new client.Registry();
    this.cEvents = new client.Counter({
      name: 'ai_stream_events_total',
      help: 'Total AI stream events by scope and event type',
      labelNames: ['scope', 'event_type'],
      registers: [this.registry],
    });
    this.cStreams = new client.Counter({
      name: 'ai_stream_terminal_total',
      help: 'AI stream terminal states by scope and result',
      labelNames: ['scope', 'result'],
      registers: [this.registry],
    });
    this.hFirstDeltaMs = new client.Histogram({
      name: 'ai_stream_time_to_first_delta_ms',
      help: 'Time from stream creation to first delta in milliseconds',
      labelNames: ['scope'],
      buckets: [50, 100, 250, 500, 1000, 2000, 5000, 10000, 30000],
      registers: [this.registry],
    });
    this.hCompleteToPersistMs = new client.Histogram({
      name: 'ai_stream_complete_to_persist_ms',
      help: 'Time from stream completion to persisted handoff in milliseconds',
      labelNames: ['scope'],
      buckets: [10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
      registers: [this.registry],
    });
  }

  recordEvent(scope: string, eventType: string) {
    this.cEvents.inc({ scope, event_type: eventType });
  }

  recordTerminal(scope: string, result: 'persisted' | 'failed' | 'cancelled') {
    this.cStreams.inc({ scope, result });
  }

  observeFirstDelta(scope: string, durationMs: number) {
    this.hFirstDeltaMs.observe({ scope }, durationMs);
  }

  observeCompleteToPersist(scope: string, durationMs: number) {
    this.hCompleteToPersistMs.observe({ scope }, durationMs);
  }

  async exportPrometheus(): Promise<string> {
    return this.registry.metrics();
  }
}

export const aiStreamMetricsService = new AIStreamMetricsService();
