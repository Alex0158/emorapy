/**
 * 自適應儀表板（已登入用戶首頁）
 * 遷移: Ant Button/Card/Typography/Space/Icons → shadcn + Tailwind + Lucide
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ArrowRight, MessageCircle, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { motion } from 'framer-motion';
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
    <div className="mx-auto max-w-3xl px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h2 className="text-2xl font-bold text-foreground font-heading">{t('home.adaptive.greeting', { name: userName })}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('home.adaptive.subtitle')}</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.1 }} className="mt-6">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="size-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-semibold text-foreground">{nextStep?.title ?? t('home.adaptive.nextStep.createNew.title')}</h4>
            <p className="mt-0.5 text-sm text-muted-foreground truncate">{nextStep?.desc ?? t('home.adaptive.nextStep.createNew.desc')}</p>
          </div>
          <Button onClick={() => navigate(nextStep?.path ?? '/case/create')} className="shrink-0 rounded-full gap-2">
            {nextStep?.action ?? t('home.adaptive.nextStep.createNew.action')}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="mt-8">
        <h5 className="mb-3 text-sm font-semibold text-muted-foreground">{t('home.adaptive.otherActions')}</h5>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/chat/room')} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-sm hover:border-primary/30">
            <MessageCircle className="size-5 text-primary" />
            <span className="text-sm font-medium text-foreground">{t('home.adaptive.action.startChat')}</span>
          </button>
          <button onClick={() => navigate('/profile/my-story')} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-sm hover:border-primary/30">
            <BookOpen className="size-5 text-primary" />
            <span className="text-sm font-medium text-foreground">{t('home.adaptive.action.viewProfile')}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AdaptiveDashboard;
