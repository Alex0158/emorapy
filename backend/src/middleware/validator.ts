import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { Errors } from '../utils/errors';

export const validate = (schema: {
  body?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];
    
    // 驗證請求體
    if (schema.body) {
      const { error } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(d => d.message));
      }
    }
    
    // 驗證路徑參數（只驗證存在的參數，且確保參數確實存在於路由定義中）
    if (schema.params) {
      // 檢查是否有 params 需要驗證
      const hasParams = Object.keys(req.params).length > 0;
      
      // 如果 schema 定義了 params 驗證，但請求中沒有 params，跳過驗證
      // 這可以防止錯誤的路由匹配導致驗證失敗
      if (hasParams) {
        const { error } = schema.params.validate(req.params, { abortEarly: false });
        if (error) {
          errors.push(...error.details.map(d => d.message));
        }
      } else {
        // 如果 schema 要求 params，但請求中沒有 params，這可能是路由匹配錯誤
        // 但我們不應該在這裡處理，讓路由處理器處理 404
      }
    }
    
    // 驗證查詢參數
    if (schema.query) {
      const { error } = schema.query.validate(req.query, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(d => d.message));
      }
    }
    
    if (errors.length > 0) {
      next(Errors.VALIDATION_ERROR(errors.join('; ')));
      return;
    }
    
    next();
  };
};

