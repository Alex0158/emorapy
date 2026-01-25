/**
 * 底部Footer
 */

import { Layout } from 'antd';
import './Footer.less';

const { Footer: AntFooter } = Layout;

const Footer = () => {
  return (
    <AntFooter className="app-footer">
      <div className="footer-content">
        <p>© 2024 熊媽媽法庭（Mother Bear Court）</p>
        <p>即使在法庭，我也會保護和呵護你們兩位</p>
      </div>
    </AntFooter>
  );
};

export default Footer;

