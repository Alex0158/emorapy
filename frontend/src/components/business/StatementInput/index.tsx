/**
 * 陳述輸入組件
 *
 * 遷移: Ant Input.TextArea/Typography/Tooltip/Icons → 原生 textarea + Lucide + Tailwind
 */

import { HelpCircle, CheckCircle, XCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { validateStatement } from '@/utils/validate';
import { MAX_STATEMENT_LENGTH, MIN_STATEMENT_LENGTH } from '@/utils/constants';
import { formatWordCount } from '@/utils/format';
import { cn } from '@/lib/utils';
import { t } from '@/utils/i18n';

interface StatementInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  role?: 'plaintiff' | 'defendant';
  showGuide?: boolean;
  autoFocus?: boolean;
  onValidationChange?: (isValid: boolean) => void;
  minLength?: number;
  allowEmpty?: boolean;
}

const StatementInput = ({
  value,
  onChange,
  placeholder = t('statementInput.defaultPlaceholder'),
  label,
  role = 'plaintiff',
  showGuide = true,
  autoFocus = false,
  onValidationChange,
  minLength = MIN_STATEMENT_LENGTH,
  allowEmpty = false,
}: StatementInputProps) => {
  const [focused, setFocused] = useState(false);
  const [validation, setValidation] = useState<{ valid: boolean; message?: string }>({ valid: false });

  useEffect(() => {
    const trimmed = value.trim();
    if (allowEmpty && trimmed.length === 0) {
      const result = { valid: true, message: undefined };
      setValidation(result);
      onValidationChange?.(result.valid);
      return;
    }
    const result = validateStatement(value, minLength);
    setValidation(result);
    onValidationChange?.(result.valid);
  }, [value, onValidationChange, allowEmpty, minLength]);

  const wordCount = value.trim().length;
  const isComplete = validation.valid;
  const isEmptyAllowed = allowEmpty && wordCount === 0;

  return (
    <div className={cn('space-y-3', role === 'defendant' && 'statement-defendant')}>
      {label && <p className="text-sm font-semibold text-foreground">{label}</p>}

      {showGuide && (
        <div className={cn('space-y-1.5 transition-all duration-300', focused ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 overflow-hidden')}>
          {['guide1', 'guide2', 'guide3'].map((key) => (
            <div key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
              <HelpCircle className="size-3.5 shrink-0" />
              <span>{t(`statementInput.${key}`)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={10}
          maxLength={MAX_STATEMENT_LENGTH}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn(
            'w-full resize-none rounded-2xl border bg-white p-5 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/50 transition-all duration-300',
            'focus:outline-none focus:ring-4',
            focused
              ? 'border-primary shadow-[0_8px_32px_oklch(0.65_0.15_25/0.12)] focus:ring-primary/15'
              : 'border-border shadow-[0_4px_16px_rgba(0,0,0,0.03)] focus:ring-primary/10',
          )}
        />

        {/* Validation icon */}
        {wordCount > 0 && (
          <div className="absolute right-4 top-4">
            {isComplete ? (
              <CheckCircle className="size-5 text-success" aria-label={t('statementInput.wordCountOk')} />
            ) : (
              <XCircle className="size-5 text-muted-foreground/40" aria-label={validation.message} />
            )}
          </div>
        )}
      </div>

      {/* Word count / status */}
      <p className={cn(
        'text-xs text-right',
        isComplete ? 'text-success' : isEmptyAllowed ? 'text-muted-foreground' : wordCount < minLength ? 'text-warning' : 'text-muted-foreground',
      )}>
        {isEmptyAllowed ? t('statementInput.optional') : validation.message || formatWordCount(wordCount, MAX_STATEMENT_LENGTH)}
      </p>
    </div>
  );
};

export default StatementInput;
