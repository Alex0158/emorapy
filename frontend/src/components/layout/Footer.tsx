/**
 * 底部 Footer
 *
 * 遷移: Ant Layout.Footer → 原生 footer + Tailwind
 */

import { t } from '@/utils/i18n';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-card/50 py-6 text-center">
      <p className="text-sm text-muted-foreground">
        {t('footer.copyright').replace('{year}', String(currentYear))}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t('footer.tagline')}
      </p>
    </footer>
  );
};

export default Footer;
