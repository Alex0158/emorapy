import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { usePsychProfileStore } from '@/store/psychProfileStore';
import { useInterviewStore } from '@/store/interviewStore';
import { getInterviewResumeNavigationPath } from '@/utils/interviewResume';
import { t } from '@/utils/i18n';

type TriggerType = 'organic' | 'onboarding' | 'pre_case' | 'post_judgment';

export function useInterviewTrigger(trigger: TriggerType) {
  const navigate = useNavigate();
  const { startSession, checkResume } = useInterviewStore();
  const { giveConsent, consentLoading } = usePsychProfileStore();
  const [profileConsent, setProfileConsent] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  const startFlow = useCallback(async () => {
    const resumeData = await checkResume();
    const resumePath = getInterviewResumeNavigationPath(resumeData);
    if (resumePath) {
      navigate(resumePath);
      return;
    }
    const session = await startSession(trigger);
    navigate(`/interview/${session.id}`);
  }, [checkResume, startSession, navigate, trigger]);

  const triggerInterview = useCallback(async () => {
    if (!profileConsent) {
      setConsentOpen(true);
      return;
    }
    try {
      await startFlow();
    } catch {
      toast.error(t('interview.startFail'));
    }
  }, [profileConsent, startFlow]);

  const handleConsent = useCallback(async () => {
    try {
      await giveConsent();
      setProfileConsent(true);
      setConsentOpen(false);
      await startFlow();
    } catch {
      toast.error(t('interview.startFail'));
    }
  }, [giveConsent, startFlow]);

  return {
    triggerInterview,
    consentOpen,
    setConsentOpen,
    profileConsent,
    setProfileConsent,
    handleConsent,
    consentLoading,
  };
}
