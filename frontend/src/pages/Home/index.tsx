/**
 * 首頁 - Landing Page
 *
 * 遷移: Ant Button/Icons → shadcn Button + Lucide
 * 保留: FlowSimulation, AdaptiveDashboard 子組件（後續單獨遷移）
 * 保留: Home.css（子組件和 section 佈局）
 * 新增: 環境動畫光暈背景（Hero 區域）
 */

import { lazy, Suspense, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, Heart, Lightbulb, CheckCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MediatorAvatar from '@/components/business/MediatorAvatar';
import SEO from '@/components/common/SEO';
import AnimatedWrapper from '@/components/common/AnimatedWrapper';
const FlowSimulation = lazy(() => import('./components/FlowSimulation'));
import AdaptiveDashboard from './components/AdaptiveDashboard';
import { useAuthStore } from '@/store/authStore';
import { t } from '@/utils/i18n';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const handleQuickStart = () => {
    navigate(isAuthenticated ? '/case/create' : '/quick-experience/create');
  };

  const features = useMemo(
    () => [
      { icon: <Rocket className="size-6" />, titleKey: 'home.features.quick.title', descKey: 'home.features.quick.desc', ariaKey: 'home.features.quick.aria' },
      { icon: <Lightbulb className="size-6" />, titleKey: 'home.features.ai.title', descKey: 'home.features.ai.desc', ariaKey: 'home.features.ai.aria' },
      { icon: <Heart className="size-6" />, titleKey: 'home.features.reconciliation.title', descKey: 'home.features.reconciliation.desc', ariaKey: 'home.features.reconciliation.aria' },
      { icon: <CheckCircle className="size-6" />, titleKey: 'home.features.execution.title', descKey: 'home.features.execution.desc', ariaKey: 'home.features.execution.aria' },
    ],
    [],
  );

  const processSteps = useMemo(
    () => [
      { number: 1, titleKey: 'home.process.step1.title', descKey: 'home.process.step1.desc' },
      { number: 2, titleKey: 'home.process.step2.title', descKey: 'home.process.step2.desc' },
      { number: 3, titleKey: 'home.process.step3.title', descKey: 'home.process.step3.desc' },
      { number: 4, titleKey: 'home.process.step4.title', descKey: 'home.process.step4.desc' },
    ],
    [],
  );

  return (
    <>
      <SEO title={t('home.title')} description={t('home.description')} keywords={t('home.keywords')} />
      <div className="home-page">
        <a href="#main-content" className="skip-link">{t('home.skipToContent')}</a>

        {isAuthenticated ? (
          <section className="adaptive-hero-section" id="main-content">
            <AdaptiveDashboard />
          </section>
        ) : (
          <section id="main-content" className="hero-section relative overflow-hidden" aria-label={t('home.hero.ariaLabel')}>
            {/* Ambient orbs (warm coral glow) */}
            <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
              <div className="absolute -right-[15%] -top-[20%] h-[50vw] w-[50vw] rounded-full bg-primary/10 blur-[100px] animate-[float-orb_25s_ease-in-out_infinite_alternate]" />
              <div className="absolute -left-[10%] bottom-[10%] h-[40vw] w-[40vw] rounded-full bg-secondary/8 blur-[80px] animate-[float-orb_20s_ease-in-out_infinite_alternate-reverse]" />
            </div>

            <div className="hero-content">
              <AnimatedWrapper animation="slide" direction="right" delay={0} duration={300} className="hero-text">
                <h1 className="hero-title">{t('home.hero.heading')}</h1>
                <p className="hero-subtitle">{t('home.hero.subtitle')}</p>
                <div className="hero-actions" role="group" aria-label={t('home.ariaHeroActions')}>
                  <Button
                    size="lg"
                    onClick={handleQuickStart}
                    className="h-12 rounded-full px-8 text-base font-semibold shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
                    aria-label={t('home.hero.quickStartAria')}
                  >
                    <Rocket className="size-4" />
                    {t('home.hero.quickStart')}
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => navigate('/auth/register')}
                    className="h-12 rounded-full px-8 text-base font-semibold"
                    aria-label={t('home.hero.learnMoreAria')}
                  >
                    {t('home.hero.learnMore')}
                  </Button>
                </div>
              </AnimatedWrapper>
              <AnimatedWrapper animation="fade" delay={100} duration={300} className="hero-image">
                <MediatorAvatar size="large" animated />
              </AnimatedWrapper>
            </div>
          </section>
        )}

        <Suspense fallback={null}>
          <FlowSimulation />
        </Suspense>

        <section className="features-section" aria-labelledby="features-title">
          <div className="container">
            <AnimatedWrapper animation="fade" trigger="intersection" duration={400}>
              <h2 id="features-title" className="section-title">{t('home.features.title')}</h2>
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
                  <div className="home-feature-card" aria-label={t(feature.ariaKey)} tabIndex={0} role="article">
                    <div className="feature-icon" aria-hidden="true">{feature.icon}</div>
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
              <h2 id="process-title" className="section-title">{t('home.process.title')}</h2>
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
                    <div className="step-number" aria-hidden="true">{step.number}</div>
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
              size="lg"
              onClick={handleQuickStart}
              className="h-12 rounded-full px-8 text-base font-semibold shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
              aria-label={isAuthenticated ? t('home.hero.createCaseAria') : t('home.hero.quickStartAria')}
            >
              {isAuthenticated ? <FileText className="size-4" /> : <Rocket className="size-4" />}
              {isAuthenticated ? t('home.hero.createCase') : t('home.cta.button')}
            </Button>
          </div>
        </section>
      </div>

      <style>{`
        @keyframes float-orb {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(2vw, 3vh) scale(1.05); }
          100% { transform: translate(-1vw, -2vh) scale(0.97); }
        }
      `}</style>
    </>
  );
};

export default Home;
