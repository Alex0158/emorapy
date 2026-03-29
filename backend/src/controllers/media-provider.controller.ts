import { NextFunction, Request, Response } from 'express';
import { mediaProviderService } from '../services/media-provider.service';

class MediaProviderController {
  async listCatalog(_req: Request, res: Response, next: NextFunction) {
    try {
      const providerType = (_req.query.providerType === 'image' || _req.query.providerType === 'video')
        ? _req.query.providerType
        : undefined;
      const items = mediaProviderService.listCatalog({ providerType });
      res.json({
        success: true,
        data: { items },
      });
    } catch (error) {
      next(error);
    }
  }

  async testProvider(req: Request, res: Response, next: NextFunction) {
    try {
      const { providerKey } = req.params;
      const body = (req.body || {}) as {
        model?: string;
        count?: number;
        durationSeconds?: number;
        sourceImageUrl?: string;
        prompt?: string;
        apiKey?: string;
        api_key?: string;
        base_url?: string;
        baseUrl?: string;
        timeout_ms?: number;
        timeoutMs?: number;
        source_image_url?: string;
      };
      const input = {
        apiKey: body.apiKey || body.api_key,
        baseUrl: body.baseUrl || body.base_url,
        timeoutMs: body.timeoutMs ?? body.timeout_ms,
        model: body.model,
        count: body.count,
        durationSeconds: body.durationSeconds,
        sourceImageUrl: body.sourceImageUrl || body.source_image_url,
        prompt: body.prompt,
      };
      const result = await mediaProviderService.testConnection(providerKey, {
        ...input,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async estimateCost(req: Request, res: Response, next: NextFunction) {
    try {
      const { providerKey } = req.params;
      const body = (req.body || {}) as {
        count?: number;
        durationSeconds?: number;
        pricingOverride?: {
          billingUnit: 'image' | 'second' | 'frame';
          unitPriceUsd: number;
        };
      };
      const result = await mediaProviderService.estimateCost({
        providerKey,
        count: body.count,
        durationSeconds: body.durationSeconds,
        pricingOverride: body.pricingOverride,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generateImages(req: Request, res: Response, next: NextFunction) {
    try {
      const { providerKey } = req.params;
      const body = (req.body || {}) as {
        model?: string;
        count?: number;
        width?: number;
        height?: number;
        prompt: string;
        apiKey?: string;
        api_key?: string;
        base_url?: string;
        baseUrl?: string;
        timeout_ms?: number;
        timeoutMs?: number;
      };

      const { assets, requestId, raw } = await mediaProviderService.generateImages(providerKey, {
        model: body.model,
        count: body.count,
        width: body.width,
        height: body.height,
        prompt: body.prompt,
      }, {
        apiKey: body.apiKey || body.api_key,
        baseUrl: body.baseUrl || body.base_url,
        timeoutMs: body.timeoutMs ?? body.timeout_ms,
      });

      res.json({
        success: true,
        data: {
          providerKey,
          requestId,
          assets,
          raw,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async generateVideos(req: Request, res: Response, next: NextFunction) {
    try {
      const { providerKey } = req.params;
      const body = (req.body || {}) as {
        model?: string;
        durationSeconds?: number;
        sourceImageUrl?: string;
        prompt: string;
        apiKey?: string;
        api_key?: string;
        base_url?: string;
        baseUrl?: string;
        timeout_ms?: number;
        timeoutMs?: number;
        source_image_url?: string;
      };

      const { assets, requestId, raw } = await mediaProviderService.generateVideos(providerKey, {
        model: body.model,
        durationSeconds: body.durationSeconds,
        sourceImageUrl: body.sourceImageUrl || body.source_image_url,
        prompt: body.prompt,
      }, {
        apiKey: body.apiKey || body.api_key,
        baseUrl: body.baseUrl || body.base_url,
        timeoutMs: body.timeoutMs ?? body.timeout_ms,
      });

      res.json({
        success: true,
        data: {
          providerKey,
          requestId,
          assets,
          raw,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const mediaProviderController = new MediaProviderController();
