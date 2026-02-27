import prisma from '../config/database';
import logger from '../config/logger';

class SystemConfigService {
  async getConfigValue<T>(key: string): Promise<T | undefined> {
    try {
      const row = await prisma.systemConfig.findUnique({
        where: { key },
        select: { value: true },
      });
      if (!row) return undefined;
      return row.value as T;
    } catch (error) {
      logger.warn('Failed to read system config', { key, error });
      return undefined;
    }
  }

  async getBooleanConfig(key: string, fallback: boolean): Promise<boolean> {
    const value = await this.getConfigValue<unknown>(key);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
    return fallback;
  }

  async getNumberConfig(key: string, fallback: number): Promise<number> {
    const value = await this.getConfigValue<unknown>(key);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  }
}

export const systemConfigService = new SystemConfigService();

