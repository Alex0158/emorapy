import { AppError, Errors } from '../../utils/errors';
import {
  MediaProviderGenerationResult,
  MediaProviderImageInput,
  MediaProviderRuntimeConfig,
  MediaProviderTestResult,
  MediaProviderVideoInput,
} from './types';
import { BaseMediaProvider } from './base-media-provider';

type SeedanceStatus = 'created' | 'running' | 'processing' | 'completed' | 'succeeded' | 'failed' | 'error' | 'canceled';

const DEFAULT_TASK_POLL_INTERVAL_MS = 3000;

export class SeedanceVideoProvider extends BaseMediaProvider {
  constructor() {
    super(
      'seedance',
      'video',
      'Seedance',
      'https://api.seedance.ai',
      { billingUnit: 'second', unitPriceUsd: 0 }
    );
  }

  async testConnection(
    config: MediaProviderRuntimeConfig
  ): Promise<MediaProviderTestResult> {
    const start = Date.now();
    const baseUrl = config.baseUrl || this.defaultBaseUrl;
    const timeoutMs = this.getTimeout(config);
    const testCandidates = [
      '/v1/videos/models',
      '/v1/models',
      '/health',
    ];

    for (const endpoint of testCandidates) {
      try {
        const { body } = await this.requestJson<unknown>({
          baseUrl,
          endpoint,
          method: 'GET',
          apiKey: config.apiKey,
          timeoutMs,
        });
        return {
          success: true,
          message: `${this.displayName} 連線測試成功`,
          latencyMs: Date.now() - start,
          detail: body,
        };
      } catch (error) {
        if (error instanceof Error && /授權|未授權|API Key|Unauthorized/i.test(error.message)) {
          throw error;
        }
      }
    }

    throw Errors.EXTERNAL_SERVICE_ERROR(`${this.displayName} 連線測試失敗，請檢查 baseUrl/API Key`);
  }

  async generateImages(
    _input: MediaProviderImageInput,
    _config: MediaProviderRuntimeConfig
  ): Promise<MediaProviderGenerationResult> {
    throw Errors.VALIDATION_ERROR('Seedance 目前僅支援 video 任務');
  }

  async generateVideos(
    input: MediaProviderVideoInput,
    config: MediaProviderRuntimeConfig
  ): Promise<MediaProviderGenerationResult> {
    const baseUrl = config.baseUrl || this.defaultBaseUrl;
    const timeoutMs = this.getTimeout(config);
    const durationSeconds = this.mapPositiveInt(input.durationSeconds ?? 5, 5);
    const payloadCandidates = this.buildCreatePayloadCandidates(input, durationSeconds);

    let lastCreateError: string | undefined;
    for (const candidate of payloadCandidates) {
      try {
        const { body: createBody, status } = await this.requestJson<unknown>({
          baseUrl,
          endpoint: '/v1/videos/generations',
          method: 'POST',
          apiKey: config.apiKey,
          payload: candidate,
          timeoutMs,
        });
        if (!this.isSuccessStatus(status)) {
          throw Errors.EXTERNAL_SERVICE_ERROR(`${this.displayName} 影像任務建立失敗`);
        }

        const directAssets = this.toNormalizedProviderAssets(createBody, 'video');
        if (directAssets.length > 0) {
          return {
            assets: directAssets,
            requestId: this.getRequestId(createBody),
            raw: createBody,
          };
        }

        const taskId = this.extractTaskId(createBody);
        if (!taskId) {
          throw Errors.VALIDATION_ERROR(`${this.displayName} 回應未帶回可用影片 URL 或 taskId`);
        }
        return this.pollTask(baseUrl, taskId, config.apiKey, timeoutMs);
      } catch (error) {
        lastCreateError = error instanceof Error ? error.message : String(error);
        if (this.shouldRetryCreatePayload(error)) {
          continue;
        }
        throw error;
      }
    }

    throw Errors.EXTERNAL_SERVICE_ERROR(
      `${this.displayName} 影像任務建立失敗${lastCreateError ? `：${lastCreateError}` : ''}`
    );
  }

  protected buildCreatePayloadCandidates(
    input: MediaProviderVideoInput,
    durationSeconds: number
  ): Record<string, unknown>[] {
    const baseModel = input.model || 'video-2.0';
    const prompt = input.prompt;
    const sourceImageUrl = input.sourceImageUrl;
    return [
      this.toRequestPayload({
        model: baseModel,
        prompt,
        duration: durationSeconds,
        source_image: sourceImageUrl,
      }),
      this.toRequestPayload({
        model: baseModel,
        prompt,
        duration_seconds: durationSeconds,
        source_image: sourceImageUrl,
      }),
      this.toRequestPayload({
        model: baseModel,
        prompt,
        duration: durationSeconds,
        source_image_url: sourceImageUrl,
      }),
    ];
  }

  protected shouldRetryCreatePayload(error: unknown): boolean {
    if (!(error instanceof AppError)) {
      return false;
    }
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return false;
    }
    const normalizedMessage = error.message.toLowerCase();
    return (
      error.statusCode >= 400 &&
      error.statusCode < 500 &&
      (/400|422|invalid|格式|參數|bad request|missing/.test(normalizedMessage))
    );
  }

  protected async pollTask(
    baseUrl: string,
    taskId: string,
    apiKey: string,
    timeoutMs: number
  ): Promise<MediaProviderGenerationResult> {
    const maxAttempts = Math.max(8, Math.min(90, Math.floor(timeoutMs / 1000)));
    const candidates = [
      `/v1/videos/tasks/${taskId}`,
      `/v1/video/tasks/${taskId}`,
      `/v1/tasks/${taskId}`,
      `/v1/video/task/${taskId}`,
      `/v1/videos/${taskId}`,
    ];

    let lastError: string | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      for (const endpoint of candidates) {
        try {
          const { body } = await this.requestJson<unknown>({
            baseUrl,
            endpoint,
            method: 'GET',
            apiKey,
            timeoutMs: Math.min(timeoutMs, 12000),
          });
          const status = this.extractTaskStatus(body);
          if (status === 'succeeded' || status === 'completed') {
            const assets = this.toNormalizedProviderAssets(body, 'video');
            if (assets.length > 0) {
              return {
                requestId: taskId,
                assets,
                raw: body,
              };
            }
            throw Errors.VALIDATION_ERROR(`${this.displayName} 任務完成但未回傳影片 URL`);
          }
          if (status === 'failed' || status === 'error' || status === 'canceled') {
            const failure = this.extractFailureMessage(body);
            throw Errors.EXTERNAL_SERVICE_ERROR(`${this.displayName} 影像任務失敗${failure ? `：${failure}` : ''}`);
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
      if (attempt >= maxAttempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, DEFAULT_TASK_POLL_INTERVAL_MS));
    }

    throw Errors.EXTERNAL_SERVICE_ERROR(`${this.displayName} 任務輪詢逾時${lastError ? `：${lastError}` : ''}`);
  }

  protected extractTaskStatus(raw: unknown): SeedanceStatus {
    if (!raw || typeof raw !== 'object') return 'processing';
    const obj = raw as Record<string, unknown>;
    const status = typeof obj.status === 'string' ? obj.status.toLowerCase().trim() : '';
    if (
      status === 'succeeded' ||
      status === 'completed' ||
      status === 'done' ||
      status === 'ready'
    ) return 'succeeded';
    if (
      status === 'failed' ||
      status === 'error' ||
      status === 'canceled' ||
      status === 'cancelled'
    ) return 'failed';
    return (status as SeedanceStatus) || 'processing';
  }

  protected extractTaskId(raw: unknown): string | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const obj = raw as Record<string, unknown>;
    const candidate = [
      obj.task_id,
      obj.taskId,
      obj.id,
      obj.job_id,
      obj.jobId,
    ];
    for (const item of candidate) {
      if (typeof item === 'string' && item.trim()) return item.trim();
    }
    return undefined;
  }

  protected extractFailureMessage(raw: unknown): string | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const obj = raw as Record<string, unknown>;
    const nested = obj.error || obj.message || obj.reason || obj.failReason;
    if (typeof nested === 'string') return nested;
    if (obj.error && typeof obj.error === 'object' && typeof (obj.error as Record<string, unknown>).message === 'string') {
      return (obj.error as Record<string, unknown>).message as string;
    }
    return undefined;
  }

  protected getRequestId(raw: unknown): string | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const obj = raw as Record<string, unknown>;
    const direct = obj.request_id;
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const taskId = obj.task_id;
    if (typeof taskId === 'string' && taskId.trim()) return taskId.trim();
    return undefined;
  }
}
