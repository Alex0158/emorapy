/**
 * 首頁 - 重構優化版
 */

import { useMemo } from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { RocketOutlined, HeartOutlined, BulbOutlined, CheckCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import MediatorAvatar from '@/components/business/MediatorAvatar';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
import FlowSimulation from './components/FlowSimulation';
import AdaptiveDashboard from './components/AdaptiveDashboard';
import { useAuthStore } from '@/store/authStore';
import { t } from '@/utils/i18n';
import './Home.less';

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const handleQuickStart = () => {
    navigate(isAuthenticated ? '/case/create' : '/quick-experience/create');
  };

  const features = useMemo(
    () => [
      { icon: <RocketOutlined />, titleKey: 'home.features.quick.title', descKey: 'home.features.quick.desc', ariaKey: 'home.features.quick.aria' },
      { icon: <BulbOutlined />, titleKey: 'home.features.ai.title', descKey: 'home.features.ai.desc', ariaKey: 'home.features.ai.aria' },
      { icon: <HeartOutlined />, titleKey: 'home.features.reconciliation.title', descKey: 'home.features.reconciliation.desc', ariaKey: 'home.features.reconciliation.aria' },
      { icon: <CheckCircleOutlined />, titleKey: 'home.features.execution.title', descKey: 'home.features.execution.desc', ariaKey: 'home.features.execution.aria' },
    ],
    []
  );

  const processSteps = useMemo(
    () => [
      { number: 1, titleKey: 'home.process.step1.title', descKey: 'home.process.step1.desc' },
      { number: 2, titleKey: 'home.process.step2.title', descKey: 'home.process.step2.desc' },
      { number: 3, titleKey: 'home.process.step3.title', descKey: 'home.process.step3.desc' },
      { number: 4, titleKey: 'home.process.step4.title', descKey: 'home.process.step4.desc' },
    ],
    []
  );

  return (
    <>
      <SEO
        title={t('home.title')}
        description={t('home.description')}
        keywords={t('home.keywords')}
      />
      <div className="home-page">
        <a href="#main-content" className="skip-link">
          {t('home.skipToContent')}
        </a>

        {isAuthenticated ? (
          <section className="adaptive-hero-section" id="main-content">
            <AdaptiveDashboard />
          </section>
        ) : (
          <section id="main-content" className="hero-section" aria-label={t('home.hero.ariaLabel')}>
            <div className="hero-content">
              <AnimatedWrapper animation="slide" direction="right" delay={150} duration={400} className="hero-text">
                <h1 className="hero-title">
                  {t('home.hero.heading')}
                </h1>
                <p className="hero-subtitle">
                  {t('home.hero.subtitle')}
                </p>
                <div className="hero-actions" role="group" aria-label={t('home.ariaHeroActions')}>
                  <Button
                    type="primary"
                    size="large"
                    shape="round"
                    icon={<RocketOutlined />}
                    onClick={handleQuickStart}
                    className="primary-button"
                    aria-label={t('home.hero.quickStartAria')}
                  >
                    {t('home.hero.quickStart')}
                  </Button>
                  <Button
                    size="large"
                    shape="round"
                    onClick={() => navigate('/auth/register')}
                    className="hero-btn-secondary"
                    aria-label={t('home.hero.learnMoreAria')}
                  >
                    {t('home.hero.learnMore')}
                  </Button>
                </div>
              </AnimatedWrapper>
              <AnimatedWrapper animation="fade" delay={250} duration={400} className="hero-image">
                <MediatorAvatar size="large" animated />
              </AnimatedWrapper>
            </div>
          </section>
        )}

        <FlowSimulation />

        <section className="features-section" aria-labelledby="features-title">
          <div className="container">
            <AnimatedWrapper animation="fade" trigger="intersection" duration={400}>
              <h2 id="features-title" className="section-title">
                {t('home.features.title')}
              </h2>
            </AnimatedWrapper>
            <div className="features-grid">
              {features.map((feature, index) => (
                <AnimatedWrapper
                  key={index}
                  animation="slide"
                  direction="up"
                  delay={index * 80}
                  duration={400}
                  trigger="intersection"
                >
                  <div
                    className="home-feature-card"
                    aria-label={t(feature.ariaKey)}
                    tabIndex={0}
                    role="article"
                  >
                    <div className="feature-icon" aria-hidden="true">
                      {feature.icon}
                    </div>
                    <h3>{t(feature.titleKey)}</h3>
                    <p>{t(feature.descKey)}</p>
                  </div>
                </AnimatedWrapper>
              ))}
            </div>
          </div>
        </section>

        <section className="process-section" aria-labelledby="process-title">
          <div className="container">
            <AnimatedWrapper animation="fade" trigger="intersection" duration={400}>
              <h2 id="process-title" className="section-title">
                {t('home.process.title')}
              </h2>
            </AnimatedWrapper>
            <div className="process-timeline">
              {processSteps.map((step, index) => (
                <AnimatedWrapper
                  key={step.number}
                  animation="slide"
                  direction="up"
                  delay={index * 80}
                  duration={400}
                  trigger="intersection"
                >
                  <div
                    className="process-step"
                    role="article"
                    aria-label={t('home.process.stepAria').replace('{number}', String(step.number)).replace('{title}', t(step.titleKey))}
                  >
                    <div className="step-number" aria-hidden="true">
                      {step.number}
                    </div>
                    <h3>{t(step.titleKey)}</h3>
                    <p>{t(step.descKey)}</p>
                  </div>
                </AnimatedWrapper>
              ))}
            </div>
          </div>
        </section>

        <section className="cta-section" aria-labelledby="cta-title">
          <div className="cta-inner">
            <h2 id="cta-title" className="cta-title">
              {isAuthenticated ? t('home.cta.titleAuth') : t('home.cta.title')}
            </h2>
            <p className="cta-desc">{isAuthenticated ? t('home.cta.descAuth') : t('home.cta.desc')}</p>
            <Button
              type="primary"
              size="large"
              icon={isAuthenticated ? <FileTextOutlined /> : <RocketOutlined />}
              onClick={handleQuickStart}
              className="cta-button"
              aria-label={isAuthenticated ? t('home.hero.createCaseAria') : t('home.hero.quickStartAria')}
            >
              {isAuthenticated ? t('home.hero.createCase') : t('home.cta.button')}
            </Button>
          </div>
        </section>
      </div>
    </>
  );
};

export default Home;
