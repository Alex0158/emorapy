/**
 * 操作按鈕區域（立即註冊、再創建等）
 */

import { Button } from 'antd';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { t } from '@/utils/i18n';

type Props = {
  onRegister: () => void;
  onBackToCreate?: () => void;
};

const ActionsSection = ({ onRegister, onBackToCreate }: Props) => {
  return (
    <AnimatedWrapper animation="slide" direction="up" delay={500} trigger="intersection">
      <section className="actions-section" aria-label="後續操作">
        <div className="container">
          <div className="primary-actions">
            <Button type="primary" size="large" onClick={onRegister} aria-label={t('register.action.now')}>
              {t('register.action.now')}
            </Button>
          </div>
          {onBackToCreate && (
            <div className="secondary-actions">
              <Button type="default" onClick={onBackToCreate}>
                {t('actions.createAnother')}
              </Button>
            </div>
          )}
        </div>
      </section>
    </AnimatedWrapper>
  );
};

export default ActionsSection;
