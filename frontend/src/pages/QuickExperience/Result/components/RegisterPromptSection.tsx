import { Alert, Button, Space } from 'antd';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import { t } from '@/utils/i18n';

type Props = {
  show: boolean;
  onRegister: () => void;
  onClose: () => void;
};

const RegisterPromptSection = ({ show, onRegister, onClose }: Props) => {
  if (!show) return null;
  return (
    <AnimatedWrapper animation="slide" direction="up" delay={600} trigger="intersection">
      <section className="register-prompt-section" aria-labelledby="register-prompt">
        <div className="container">
          <Alert
            id="register-prompt"
            title={t('register.prompt.title')}
            description={t('register.prompt.desc')}
            type="info"
            action={
              <Space>
                <Button type="primary" onClick={onRegister} aria-label={t('register.action.now')}>
                  {t('register.action.now')}
                </Button>
                <Button onClick={onClose} aria-label={t('register.action.later')}>
                  {t('register.action.later')}
                </Button>
              </Space>
            }
            closable
            onClose={onClose}
          />
        </div>
      </section>
    </AnimatedWrapper>
  );
};

export default RegisterPromptSection;
