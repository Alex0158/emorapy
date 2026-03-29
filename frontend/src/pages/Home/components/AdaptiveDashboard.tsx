import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Typography, Space } from 'antd';
import { FileTextOutlined, ArrowRightOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import { motion } from 'framer-motion';
import { getCaseList } from '@/services/api/case';
import { t } from '@/utils/i18n';
import './AdaptiveDashboard.less';

const { Title, Text } = Typography;

type NextStep = {
  type: 'case_draft' | 'create_new';
  title: string;
  desc: string;
  action: string;
  path: string;
};

const AdaptiveDashboard = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const userName = user?.nickname || user?.email?.split('@')[0] || '';
  const [nextStep, setNextStep] = useState<NextStep | null>(null);
  const staleRef = useRef(false);

  useEffect(() => {
    staleRef.current = false;
    if (!isAuthenticated) {
      setNextStep({
        type: 'create_new',
        title: t('home.adaptive.nextStep.createNew.title'),
        desc: t('home.adaptive.nextStep.createNew.desc'),
        action: t('home.adaptive.nextStep.createNew.action'),
        path: '/quick-experience/create',
      });
      return;
    }
    const fetchDraft = async () => {
      try {
        const { cases } = await getCaseList({ status: 'draft', page_size: 1 });
        if (staleRef.current) return;
        const draftCase = cases?.[0];
        if (draftCase) {
          setNextStep({
            type: 'case_draft',
            title: t('home.adaptive.nextStep.title'),
            desc: t('home.adaptive.nextStep.desc'),
            action: t('home.adaptive.nextStep.action'),
            path: `/case/${draftCase.id}`,
          });
        } else {
          setNextStep({
            type: 'create_new',
            title: t('home.adaptive.nextStep.createNew.title'),
            desc: t('home.adaptive.nextStep.createNew.desc'),
            action: t('home.adaptive.nextStep.createNew.action'),
            path: '/case/create',
          });
        }
      } catch {
        if (staleRef.current) return;
        setNextStep({
          type: 'create_new',
          title: t('home.adaptive.nextStep.createNew.title'),
          desc: t('home.adaptive.nextStep.createNew.desc'),
          action: t('home.adaptive.nextStep.createNew.action'),
          path: '/case/create',
        });
      }
    };
    fetchDraft();
    return () => { staleRef.current = true; };
  }, [isAuthenticated]);

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
              <Title level={4}>{nextStep?.title ?? t('home.adaptive.nextStep.createNew.title')}</Title>
              <Text type="secondary">{nextStep?.desc ?? t('home.adaptive.nextStep.createNew.desc')}</Text>
            </div>
            <Button 
              type="primary" 
              size="large" 
              shape="round"
              icon={<ArrowRightOutlined />}
              iconPlacement="end"
              onClick={() => navigate(nextStep?.path ?? '/case/create')}
              className="action-btn"
            >
              {nextStep?.action ?? t('home.adaptive.nextStep.createNew.action')}
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
