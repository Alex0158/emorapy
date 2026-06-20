import type { PsychDomain } from '@emorapy/contracts/interview';

import { t } from '@/src/i18n';

const psychDomainLabelKeys: Record<PsychDomain, string> = {
  attachment: 'pd.a',
  family_origin: 'pd.fo',
  life_events: 'pd.le',
  belief_values: 'pd.bv',
  cultural_background: 'pd.cb',
  education_cognition: 'pd.ec',
  personality: 'pd.p',
  relationship_history: 'pd.rh',
};

export function labelPsychDomain(domain: string): string {
  return t(psychDomainLabelKeys[domain as PsychDomain] ?? 'pd.o');
}

export function labelPsychDomains(domains?: readonly string[] | null): string {
  const labels = [...new Set(domains ?? [])].map(labelPsychDomain);
  return labels.length ? labels.join(t('pd.sep')) : t('pd.none');
}
