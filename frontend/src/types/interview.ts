import { t } from '@/utils/i18n';
import type { PsychDomain } from '@cj/contracts/interview';
export * from '@cj/contracts/interview';

export function getDomainLabel(domain: PsychDomain): string {
  return t(`psychProfile.domain.${domain}`);
}
