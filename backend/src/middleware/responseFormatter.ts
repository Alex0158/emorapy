import { Request, Response, NextFunction } from 'express';

/**
 * 響應格式化中間件
 * 統一API響應格式，添加請求ID和時間戳
 * 注意：requestId 應由 requestId 中間件生成，這裡只使用已有的 requestId
 */
export const responseFormatter = (req: Request, res: Response, next: NextFunction): void => {
  // 使用已有的 requestId（由 requestId 中間件生成）
  // 如果沒有 requestId（理論上不應該發生），使用空字符串
  const requestId = req.requestId ?? '';

  // 保存原始的json方法
  const originalJson = res.json.bind(res);

  // 重寫json方法，統一響應格式
  res.json = function (data: any) {
    // 如果已經是格式化後的響應，直接返回
    if (data && typeof data === 'object' && 'success' in data) {
      // 添加meta信息
      if (!data.meta) {
        data.meta = {};
      }
      data.meta.request_id = requestId;
      data.meta.timestamp = new Date().toISOString();
      // 將內部 data.status 透出到頂層方便調試/監控
      if (!('status' in data) && data.data && typeof data.data === 'object' && 'status' in data.data) {
        (data as any).status = (data as any).data.status;
      }
      return originalJson(data);
    }

    // 格式化成功響應
    const formattedResponse = {
      success: true,
      data,
      ...(data && typeof data === 'object' && 'status' in data ? { status: (data as any).status } : {}),
      meta: {
        request_id: requestId,
        timestamp: new Date().toISOString(),
      },
    };

    return originalJson(formattedResponse);
  };

  next();
};
