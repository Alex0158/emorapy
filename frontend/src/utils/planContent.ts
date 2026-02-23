import { t } from '@/utils/i18n';

interface ParsedPlanContent {
  title: string;
  description: string;
  steps: string[];
  expected_effect: string;
}

export function safeParsePlanContent(raw: string): ParsedPlanContent {
  const fallback: ParsedPlanContent = {
    title: raw.split('\n')[0] || t('reconList.heading'),
    description: raw,
    steps: [],
    expected_effect: '',
  };

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        title: typeof parsed.title === 'string' ? parsed.title : fallback.title,
        description: typeof parsed.description === 'string' ? parsed.description : fallback.description,
        steps: Array.isArray(parsed.steps) ? parsed.steps.filter((s: unknown) => typeof s === 'string') : [],
        expected_effect: typeof parsed.expected_effect === 'string' ? parsed.expected_effect : '',
      };
    }
  } catch {
    // not JSON, use raw text as fallback
  }

  return fallback;
}
