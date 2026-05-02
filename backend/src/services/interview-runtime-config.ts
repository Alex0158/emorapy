import { env } from '../config/env';
import { systemConfigService } from './system-config.service';

export interface RuntimeInterviewConfig {
  maxTurns: number;
  softTarget: number;
  turnIntervalMs: number;
  startRateLimit: number;
  dailySessionLimit: number;
}

export async function loadRuntimeInterviewConfig(): Promise<RuntimeInterviewConfig> {
  const maxTurns = await systemConfigService.getNumberConfig(
    'interview.maxTurns',
    env.INTERVIEW_MAX_TURNS
  );
  const softTarget = await systemConfigService.getNumberConfig(
    'interview.softTarget',
    env.INTERVIEW_SOFT_TARGET
  );
  const turnIntervalMs = await systemConfigService.getNumberConfig(
    'interview.turnIntervalMs',
    env.INTERVIEW_TURN_INTERVAL_MS
  );
  const startRateLimit = await systemConfigService.getNumberConfig(
    'interview.startRateLimit',
    env.INTERVIEW_START_RATE_LIMIT
  );
  const dailySessionLimit = await systemConfigService.getNumberConfig(
    'interview.dailySessionLimit',
    env.INTERVIEW_DAILY_SESSION_LIMIT
  );

  return {
    maxTurns: Math.max(Math.floor(maxTurns), 1),
    softTarget: Math.max(Math.floor(softTarget), 1),
    turnIntervalMs: Math.max(Math.floor(turnIntervalMs), 0),
    startRateLimit: Math.max(Math.floor(startRateLimit), 1),
    dailySessionLimit: Math.max(Math.floor(dailySessionLimit), 1),
  };
}
