/**
 * 底部Footer
 */

import { Layout } from 'antd';
import { t } from '@/utils/i18n';
import './Footer.less';

const { Footer: AntFooter } = Layout;

const Footer = () => {
  const currentYear = new Date().getFullYear();
  return (
    <AntFooter className="app-footer">
      <div className="footer-content">
        <p>{t('footer.copyright').replace('{year}', String(currentYear))}</p>
        <p>{t('footer.tagline')}</p>
      </div>
    </AntFooter>
  );
};

export default Footer;

