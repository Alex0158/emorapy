import { t } from '@/utils/i18n';
import type { PsychDomain } from '@emorapy/contracts/interview';
export * from '@emorapy/contracts/interview';

export function getDomainLabel(domain: PsychDomain): string {
  return t(`psychProfile.domain.${domain}`);
}
