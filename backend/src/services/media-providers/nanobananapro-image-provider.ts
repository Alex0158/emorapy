import { Errors } from '../../utils/errors';
import {
  MediaProviderGenerationResult,
  MediaProviderImageInput,
  MediaProviderRuntimeConfig,
  MediaProviderTestResult,
  MediaProviderVideoInput,
} from './types';
import { BaseMediaProvider } from './base-media-provider';

const DEFAULT_TEST_PROMPT = 'A calm neutral composition photo';

export class NanoBananaProImageProvider extends BaseMediaProvider {
  constructor() {
    super(
      'nanobananapro',
      'image',
      'NanoBananaPro',
      'https://api.nanobananapro.com',
      { billingUnit: 'image', unitPriceUsd: 0 }
    );
  }

  async testConnection(
    config: MediaProviderRuntimeConfig,
    input?: { model?: string; prompt?: string; count?: number }
  ): Promise<MediaProviderTestResult> {
    const start = Date.now();
    const baseUrl = config.baseUrl || this.defaultBaseUrl;
    const timeoutMs = this.getTimeout(config);
    const testCandidates = [
      '/v1/health',
      '/health',
      '/v1/models',
      '/models',
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

    const fallbackPayload = this.toRequestPayload({
      model: input?.model || 'default',
      prompt: input?.prompt || DEFAULT_TEST_PROMPT,
      n: this.mapPositiveInt(input?.count ?? 1, 1),
    });
    try {
      const { body, status } = await this.requestJson<unknown>({
        baseUrl,
        endpoint: '/v1/images/generations',
        method: 'POST',
        apiKey: config.apiKey,
        payload: fallbackPayload,
        timeoutMs,
      });
      if (!this.isSuccessStatus(status)) {
        throw Errors.EXTERNAL_SERVICE_ERROR(`${this.displayName} 測試請求回應異常`);
      }
      return {
        success: true,
        message: `${this.displayName} 連線測試成功（fallback 驗證）`,
        latencyMs: Date.now() - start,
        detail: body,
      };
    } catch (error) {
      throw Errors.EXTERNAL_SERVICE_ERROR(
        `${this.displayName} 測試失敗：${error instanceof Error ? error.message : '請檢查 API Key 與網路連線'}`
      );
    }
  }

  async generateImages(
    input: MediaProviderImageInput,
    config: MediaProviderRuntimeConfig
  ): Promise<MediaProviderGenerationResult> {
    const baseUrl = config.baseUrl || this.defaultBaseUrl;
    const requestPayload = this.toRequestPayload({
      model: input.model || 'default',
      prompt: input.prompt,
      n: this.mapPositiveInt(input.count, 1),
      width: input.width,
      height: input.height,
    });

    const { body, status } = await this.requestJson<unknown>({
      baseUrl,
      endpoint: '/v1/images/generations',
      method: 'POST',
      apiKey: config.apiKey,
      payload: requestPayload,
      timeoutMs: this.getTimeout(config),
    });
    if (!this.isSuccessStatus(status)) {
      throw Errors.EXTERNAL_SERVICE_ERROR(`${this.displayName} 圖片生成回應異常`);
    }

    const assets = this.toNormalizedProviderAssets(body, 'image');
    if (!assets.length) {
      throw Errors.VALIDATION_ERROR(`${this.displayName} 未回傳可用圖片 URL`);
    }
    const requestId = this.getRequestId(body);
    return {
      requestId,
      assets,
      raw: body,
    };
  }

  async generateVideos(
    _input: MediaProviderVideoInput,
    _config: MediaProviderRuntimeConfig
  ): Promise<MediaProviderGenerationResult> {
    throw Errors.VALIDATION_ERROR('NanoBananaPro 目前僅支援 image 任務');
  }

  protected getRequestId(body: unknown): string | undefined {
    if (!body || typeof body !== 'object') return undefined;
    const candidate = body as Record<string, unknown>;
    const direct = candidate.id;
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const nested = candidate.request_id;
    return typeof nested === 'string' && nested.trim() ? nested.trim() : undefined;
  }
}
      'https://api.nanobananapro.com',
      { billingUnit: 'image', unitPriceUsd: 0 }
    );
  }

  async testConnection(
    config: MediaProviderRuntimeConfig,
    input?: { model?: string; prompt?: string; count?: number }
  ): Promise<MediaProviderTestResult> {
    const start = Date.now();
    const baseUrl = config.baseUrl || this.defaultBaseUrl;
    const timeoutMs = this.getTimeout(config);
    const lastErrMessages: string[] = [];
    const testCandidates = [
      '/v1/health',
      '/health',
      '/v1/models',
      '/models',
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
        lastErrMessages.push(error instanceof Error ? error.message : String(error));
      }
    }

    const fallbackPayload = this.toRequestPayload({
      model: input?.model || 'default',
      prompt: input?.prompt || DEFAULT_TEST_PROMPT,
      n: this.mapPositiveInt(input?.count ?? 1, 1),
    });
    try {
      const { body, status } = await this.requestJson<unknown>({
        baseUrl,
        endpoint: '/v1/images/generations',
        method: 'POST',
        apiKey: config.apiKey,
        payload: fallbackPayload,
        timeoutMs,
      });
      if (!this.isSuccessStatus(status)) {
        throw Errors.EXTERNAL_SERVICE_ERROR(`${this.displayName} 測試請求回應異常`);
      }
      return {
        success: true,
        message: `${this.displayName} 連線測試成功（fallback 驗證）`,
        latencyMs: Date.now() - start,
        detail: body,
      };
    } catch (error) {
      throw Errors.EXTERNAL_SERVICE_ERROR(
        `${this.displayName} 測試失敗：${lastErrMessages[0] || (error instanceof Error ? error.message : '請檢查 API Key 與網路連線')}`
      );
    }
  }

  async generateImages(
    input: MediaProviderImageInput,
    config: MediaProviderRuntimeConfig
  ): Promise<MediaProviderGenerationResult> {
    const baseUrl = config.baseUrl || this.defaultBaseUrl;
    const requestPayload = this.toRequestPayload({
      model: input.model || 'default',
      prompt: input.prompt,
      n: this.mapPositiveInt(input.count, 1),
      width: input.width,
      height: input.height,
    });

    const { body, status } = await this.requestJson<unknown>({
      baseUrl,
      endpoint: '/v1/images/generations',
      method: 'POST',
      apiKey: config.apiKey,
      payload: requestPayload,
      timeoutMs: this.getTimeout(config),
    });
    if (!this.isSuccessStatus(status)) {
      throw Errors.EXTERNAL_SERVICE_ERROR(`${this.displayName} 圖片生成回應異常`);
    }

    const assets = this.toNormalizedProviderAssets(body, 'image');
    if (!assets.length) {
      throw Errors.VALIDATION_ERROR(`${this.displayName} 未回傳可用圖片 URL`);
    }
    const requestId = this.getRequestId(body);
    return {
      requestId,
      assets,
      raw: body,
    };
  }

  async generateVideos(
    _input: MediaProviderVideoInput,
    _config: MediaProviderRuntimeConfig
  ): Promise<MediaProviderGenerationResult> {
    throw Errors.VALIDATION_ERROR('NanoBananaPro 目前僅支援 image 任務');
  }

  protected getRequestId(body: unknown): string | undefined {
    if (!body || typeof body !== 'object') return undefined;
    const candidate = body as Record<string, unknown>;
    const direct = candidate.id;
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const nested = candidate.request_id;
    return typeof nested === 'string' && nested.trim() ? nested.trim() : undefined;
  }
}
