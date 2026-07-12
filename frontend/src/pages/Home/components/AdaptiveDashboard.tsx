/**
 * 自適應儀表板（已登入用戶首頁）
 * 遷移: Ant Button/Card/Typography/Space/Icons → shadcn + Tailwind + Lucide
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ArrowRight, MessageCircle, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { getCaseList } from '@/services/api/case';
import { t } from '@/utils/i18n';

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
      setNextStep({ type: 'create_new', title: t('home.adaptive.nextStep.createNew.title'), desc: t('home.adaptive.nextStep.createNew.desc'), action: t('home.adaptive.nextStep.createNew.action'), path: '/quick-experience/create' });
      return;
    }
    const fetchDraft = async () => {
      try {
        const { cases } = await getCaseList({ status: 'draft', page_size: 1 });
        if (staleRef.current) return;
        const draftCase = cases?.[0];
        if (draftCase) {
          setNextStep({ type: 'case_draft', title: t('home.adaptive.nextStep.title'), desc: t('home.adaptive.nextStep.desc'), action: t('home.adaptive.nextStep.action'), path: `/case/${draftCase.id}` });
        } else {
          setNextStep({ type: 'create_new', title: t('home.adaptive.nextStep.createNew.title'), desc: t('home.adaptive.nextStep.createNew.desc'), action: t('home.adaptive.nextStep.createNew.action'), path: '/case/create' });
        }
      } catch {
        if (staleRef.current) return;
        setNextStep({ type: 'create_new', title: t('home.adaptive.nextStep.createNew.title'), desc: t('home.adaptive.nextStep.createNew.desc'), action: t('home.adaptive.nextStep.createNew.action'), path: '/case/create' });
      }
    };
    fetchDraft();
    return () => { staleRef.current = true; };
  }, [isAuthenticated]);

  return (
    <div className="mx-auto max-w-4xl px-5 py-14 md:py-20">
      <div className="border-l border-primary pl-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t('home.paths.label')}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.025em] md:text-5xl">{t('home.adaptive.greeting', { name: userName })}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t('home.adaptive.subtitle')}</p>
      </div>

      <div className="mt-10 border-y border-border py-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border">
            <FileText className="size-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground">{nextStep?.title ?? t('home.adaptive.nextStep.createNew.title')}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground truncate">{nextStep?.desc ?? t('home.adaptive.nextStep.createNew.desc')}</p>
          </div>
          <Button onClick={() => navigate(nextStep?.path ?? '/case/create')} className="shrink-0 gap-2">
            {nextStep?.action ?? t('home.adaptive.nextStep.createNew.action')}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{t('home.adaptive.otherActions')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/chat/room')} className="flex min-h-20 items-center gap-3 border border-border p-4 text-left transition-colors hover:bg-surface">
            <MessageCircle className="size-5 text-primary" />
            <span className="text-sm font-medium text-foreground">{t('home.adaptive.action.startChat')}</span>
          </button>
          <button onClick={() => navigate('/profile/my-story')} className="flex min-h-20 items-center gap-3 border border-border p-4 text-left transition-colors hover:bg-surface">
            <BookOpen className="size-5 text-primary" />
            <span className="text-sm font-medium text-foreground">{t('home.adaptive.action.viewProfile')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdaptiveDashboard;
