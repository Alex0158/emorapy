import { t } from '@/utils/i18n';

interface ParsedPlanContent {
  title: string;
  description: string;
  steps: string[];
  expected_effect: string;
  fit_reason: string;
  do_not_use_when: string[];
  first_step: string;
  fallback_step: string;
  pause_rule: string;
  risk_note: string;
}

export function safeParsePlanContent(raw: string | null | undefined): ParsedPlanContent {
  const safeRaw = raw ?? '';
  const fallback: ParsedPlanContent = {
    title: safeRaw.split('\n')[0] || t('reconList.heading'),
    description: safeRaw,
    steps: [],
    expected_effect: '',
    fit_reason: '',
    do_not_use_when: [],
    first_step: '',
    fallback_step: '',
    pause_rule: '',
    risk_note: '',
  };

  try {
    const parsed = JSON.parse(safeRaw);
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        title: typeof parsed.title === 'string' ? parsed.title : fallback.title,
        description: typeof parsed.description === 'string' ? parsed.description : fallback.description,
        steps: Array.isArray(parsed.steps) ? parsed.steps.filter((s: unknown) => typeof s === 'string') : [],
        expected_effect: typeof parsed.expected_effect === 'string' ? parsed.expected_effect : '',
        fit_reason: typeof parsed.fit_reason === 'string' ? parsed.fit_reason : '',
        do_not_use_when: Array.isArray(parsed.do_not_use_when)
          ? parsed.do_not_use_when.filter((item: unknown) => typeof item === 'string')
          : [],
        first_step: typeof parsed.first_step === 'string' ? parsed.first_step : '',
        fallback_step: typeof parsed.fallback_step === 'string' ? parsed.fallback_step : '',
        pause_rule: typeof parsed.pause_rule === 'string' ? parsed.pause_rule : '',
        risk_note: typeof parsed.risk_note === 'string' ? parsed.risk_note : '',
      };
    }
  } catch {
    // not JSON, use raw text as fallback
  }

  return fallback;
}
