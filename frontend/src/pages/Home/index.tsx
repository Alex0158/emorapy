import { ArrowRight, FileText, MessageCircle, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SEO from '@/components/common/SEO';
import AdaptiveDashboard from './components/AdaptiveDashboard';
import { useAuthStore } from '@/store/authStore';
import { t } from '@/utils/i18n';

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const handleQuickStart = () => {
    navigate(isAuthenticated ? '/case/create' : '/quick-experience/create');
  };

  return (
    <>
      <SEO title={t('home.title')} description={t('home.description')} keywords={t('home.keywords')} />
      <a
        href="#main-content"
        className="sr-only z-50 bg-primary px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t('home.skipToContent')}
      </a>

      {isAuthenticated ? (
        <div id="main-content">
          <AdaptiveDashboard />
        </div>
      ) : (
        <div id="main-content">
          <section className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl gap-14 px-5 py-16 md:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.75fr)] md:items-center md:py-24">
            <div className="max-w-2xl">
              <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {t('home.hero.eyebrow')}
              </p>
              <h1 className="text-[clamp(2.75rem,7vw,5.8rem)] font-semibold leading-[0.98] tracking-[-0.045em]">
                {t('home.hero.heading')}
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground md:text-xl">
                {t('home.hero.subtitle')}
              </p>

              <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <Button size="lg" onClick={handleQuickStart} aria-label={t('home.hero.quickStartAria')}>
                  {t('home.hero.quickStart')}
                  <ArrowRight className="size-4" />
                </Button>
                <button
                  type="button"
                  onClick={() => navigate('/auth/register')}
                  className="min-h-11 px-1 text-sm font-semibold text-foreground underline decoration-border underline-offset-8 transition-colors hover:decoration-primary"
                >
                  {t('home.hero.learnMore')}
                </button>
              </div>

              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-xs leading-5 text-muted-foreground" aria-label={t('home.hero.boundariesAria')}>
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="size-4 text-secondary" aria-hidden="true" />
                  {t('home.hero.boundaryPrivate')}
                </span>
                <span>{t('home.hero.boundaryNotTherapy')}</span>
                <span>{t('home.hero.boundarySolo')}</span>
              </div>
            </div>

            <aside className="border-l border-border pl-6 md:pl-10" aria-labelledby="guided-output-title">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t('home.guided.label')}
              </p>
              <h2 id="guided-output-title" className="mt-3 text-3xl font-semibold tracking-[-0.02em]">
                {t('home.guided.title')}
              </h2>
              <ol className="mt-8 space-y-7">
                {(['context', 'difference', 'nextStep'] as const).map((item, index) => (
                  <li key={item} className="grid grid-cols-[2rem_1fr] gap-3 border-t border-border pt-4">
                    <span className="font-heading text-sm text-primary">0{index + 1}</span>
                    <div>
                      <h3 className="font-body text-sm font-semibold">{t(`home.guided.${item}.title`)}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(`home.guided.${item}.desc`)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </aside>
          </section>

          <section className="border-y border-border" aria-labelledby="choose-path-title">
            <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-[1fr_2fr] md:py-16">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t('home.paths.label')}</p>
                <h2 id="choose-path-title" className="mt-3 text-3xl font-semibold">{t('home.paths.title')}</h2>
              </div>
              <div className="grid gap-px bg-border sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => navigate('/auth/register')}
                  className="group min-h-40 bg-background p-6 text-left transition-colors hover:bg-surface"
                >
                  <FileText className="size-5 text-secondary" aria-hidden="true" />
                  <h3 className="mt-5 font-body text-base font-semibold">{t('home.paths.formal.title')}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('home.paths.formal.desc')}</p>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/auth/register')}
                  className="group min-h-40 bg-background p-6 text-left transition-colors hover:bg-surface"
                >
                  <MessageCircle className="size-5 text-secondary" aria-hidden="true" />
                  <h3 className="mt-5 font-body text-base font-semibold">{t('home.paths.chat.title')}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('home.paths.chat.desc')}</p>
                </button>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-5 py-12 md:py-16" aria-labelledby="scope-title">
            <div className="max-w-3xl border-l border-primary pl-6">
              <h2 id="scope-title" className="font-body text-sm font-semibold">{t('home.scope.title')}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('home.scope.desc')}</p>
            </div>
          </section>
        </div>
      )}
    </>
  );
};

export default Home;
