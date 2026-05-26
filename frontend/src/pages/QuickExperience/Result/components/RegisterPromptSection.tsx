import { Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/utils/i18n';

type Props = { show: boolean; onRegister: () => void; onClose: () => void };

const RegisterPromptSection = ({ show, onRegister, onClose }: Props) => {
  if (!show) return null;
  return (
    <section className="mx-auto max-w-2xl mb-6" aria-labelledby="register-prompt">
      <div className="relative flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-light/50 p-4">
        <Info className="size-5 shrink-0 mt-0.5 text-primary" />
        <div className="flex-1">
          <p id="register-prompt" className="text-sm font-medium text-foreground">{t('register.prompt.title')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('register.prompt.desc')}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={onRegister} aria-label={t('register.action.now')}>{t('register.action.now')}</Button>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('register.action.later')}>{t('register.action.later')}</Button>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label={t('common.dismiss')} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
      </div>
    </section>
  );
};

export default RegisterPromptSection;
