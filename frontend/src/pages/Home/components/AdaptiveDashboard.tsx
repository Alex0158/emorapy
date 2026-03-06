import { useNavigate } from 'react-router-dom';
import { Button, Card, Typography, Space } from 'antd';
import { FileTextOutlined, ArrowRightOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import { motion } from 'framer-motion';
import { t } from '@/utils/i18n';
import './AdaptiveDashboard.less';

const { Title, Text } = Typography;

const AdaptiveDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userName = user?.nickname || user?.email?.split('@')[0] || '';
  
  // 這裡未來可以根據真實的 caseStore 狀態來決定下一步
  // 目前先寫死一個「繼續未完成的案件」或「查看判決」的狀態
  const mockNextStep = {
    type: 'case_draft',
    title: t('home.adaptive.nextStep.title'),
    desc: t('home.adaptive.nextStep.desc'),
    action: t('home.adaptive.nextStep.action'),
    path: '/case/list'
  };

  return (
    <div className="adaptive-dashboard">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="dashboard-header"
      >
        <Title level={2} className="greeting">
          {t('home.adaptive.greeting', { name: userName })}
        </Title>
        <Text className="subtitle">{t('home.adaptive.subtitle')}</Text>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card className="next-step-card glassmorphism-2">
          <div className="card-content">
            <div className="icon-wrapper">
              <FileTextOutlined />
            </div>
            <div className="text-content">
              <Title level={4}>{mockNextStep.title}</Title>
              <Text type="secondary">{mockNextStep.desc}</Text>
            </div>
            <Button 
              type="primary" 
              size="large" 
              shape="round"
              icon={<ArrowRightOutlined />}
              iconPlacement="end"
              onClick={() => navigate(mockNextStep.path)}
              className="action-btn"
            >
              {mockNextStep.action}
            </Button>
          </div>
        </Card>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="quick-actions"
      >
        <Title level={5} className="section-title">{t('home.adaptive.otherActions')}</Title>
        <Space size="middle" className="actions-grid">
          <Card 
            hoverable 
            className="action-card"
            onClick={() => navigate('/chat/room')}
          >
            <CheckCircleOutlined className="action-icon" />
            <Text strong>{t('home.adaptive.action.startChat')}</Text>
          </Card>
          <Card 
            hoverable 
            className="action-card"
            onClick={() => navigate('/profile/my-story')}
          >
            <CheckCircleOutlined className="action-icon" />
            <Text strong>{t('home.adaptive.action.viewProfile')}</Text>
          </Card>
        </Space>
      </motion.div>
    </div>
  );
};

export default AdaptiveDashboard;
