import type { PsychDomain } from '@cj/contracts/interview';

const psychDomainLabels: Record<PsychDomain, string> = {
  attachment: '依附與親密關係',
  family_origin: '原生家庭',
  life_events: '重要人生經歷',
  belief_values: '價值觀與信念',
  cultural_background: '文化背景',
  education_cognition: '教育與認知',
  personality: '個性特質',
  relationship_history: '感情經歷',
};

export function labelPsychDomain(domain: string): string {
  return psychDomainLabels[domain as PsychDomain] ?? '其他關係脈絡';
}

export function labelPsychDomains(domains?: readonly string[] | null): string {
  const labels = [...new Set(domains ?? [])].map(labelPsychDomain);
  return labels.length ? labels.join('、') : '尚未形成';
}
