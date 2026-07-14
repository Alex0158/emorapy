import type { MediationControls } from './mediation-strategy.service';

const QUESTION_STYLE_PRIORITY: Readonly<Record<MediationControls['question_style'], number>> = {
  open: 0,
  concrete: 1,
  gentle: 2,
};

/**
 * Minimum-disclosure merge: choose the most cautious bounded value without
 * retaining owner identity, source order, reasons, or private text.
 */
export function mergeMediationControls(
  ownerControls: readonly MediationControls[],
): MediationControls | null {
  if (ownerControls.length === 0) return null;

  return ownerControls.reduce<MediationControls>((merged, controls) => ({
    pace: merged.pace === 'slower' || controls.pace === 'slower' ? 'slower' : 'normal',
    ask_permission_before_depth: (
      merged.ask_permission_before_depth || controls.ask_permission_before_depth
    ),
    offer_pause: merged.offer_pause || controls.offer_pause,
    question_style: QUESTION_STYLE_PRIORITY[controls.question_style]
      > QUESTION_STYLE_PRIORITY[merged.question_style]
      ? controls.question_style
      : merged.question_style,
    max_questions: Math.min(merged.max_questions, controls.max_questions) as 1 | 2,
  }), {
    pace: 'normal',
    ask_permission_before_depth: false,
    offer_pause: false,
    question_style: 'open',
    max_questions: 2,
  });
}
