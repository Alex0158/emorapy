/**
 * 配對管理頁面
 *
 * 遷移: Ant Card/Button/Typography/Space/Input/Alert/Spin/Form/InputNumber/Select/Divider/message/Icons
 *       → shadcn + Tailwind + sonner + Lucide
 * 保留: 所有業務邏輯（pairing CRUD, relationship profile, interview trigger, consent）
 * 保留: ConsentModal, ConfirmModal 業務組件
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, CheckCircle, UserPlus, Loader2, AlertCircle, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { createPairing, joinPairing, getPairingStatus, cancelPairing } from '@/services/api/pairing';
import type { Pairing } from '@/services/api/pairing';
import {
  getRelationshipProfile, upsertRelationshipProfile,
  type RelationshipProfile, type RelationshipProfileInput,
} from '@/services/api/profile';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import ConfirmModal from '@/components/common/ConfirmModal';
import SEO from '@/components/common/SEO';
import ConsentModal from '@/components/business/Interview/ConsentModal';
import { usePsychProfileStore } from '@/store/psychProfileStore';
import { useInterviewStore } from '@/store/interviewStore';
import { getErrorMessage } from '@/utils/apiError';
import { getInterviewResumeNavigationPath } from '@/utils/interviewResume';
import { t } from '@/utils/i18n';

interface RelationshipFormValues {
  relationship_stage?: string;
  relationship_duration_days?: number | null;
  communication_frequency?: string;
  preferred_communication_methods?: string[];
  relationship_strengths?: string;
  relationship_challenges?: string;
}

const toOptionalTrimmed = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const buildRelationshipPayload = (values: RelationshipFormValues): RelationshipProfileInput => {
  const payload: RelationshipProfileInput = {};
  const stage = toOptionalTrimmed(values.relationship_stage);
  const duration = toOptionalNumber(values.relationship_duration_days);
  const frequency = toOptionalTrimmed(values.communication_frequency);
  const strengths = toOptionalTrimmed(values.relationship_strengths);
  const challenges = toOptionalTrimmed(values.relationship_challenges);
  if (stage) payload.relationship_stage = stage;
  if (duration !== undefined) payload.relationship_duration_days = duration;
  if (frequency) payload.communication_frequency = frequency;
  if (strengths) payload.relationship_strengths = strengths;
  if (challenges) payload.relationship_challenges = challenges;
  return payload;
};

const ProfilePairing = () => {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const navigate = useNavigate();
  const { profile, fetchProfile: fetchPsychProfile, giveConsent, consentLoading } = usePsychProfileStore();
  const { startSession, checkResume } = useInterviewStore();

  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [relationshipSaving, setRelationshipSaving] = useState(false);
  const [, setRelationshipProfile] = useState<RelationshipProfile | null>(null);
  const [formValues, setFormValues] = useState<RelationshipFormValues>({});

  const mountedRef = useMountedRef();
  const staleRef = useRef(false);
  const retryLockRef = useRef(false);
  const createLockRef = useRef(false);
  const joinLockRef = useRef(false);
  const cancelLockRef = useRef(false);
  const saveLockRef = useRef(false);
  const activePairingId = pairing?.status === 'active' ? pairing.id : null;

  useEffect(() => {
    staleRef.current = false;
    fetchPairingStatus();
    fetchPsychProfile();
    return () => { staleRef.current = true; };
  }, []);

  const fetchPairingStatus = async () => {
    setLoading(true); setLoadError(false);
    try {
      const data = await getPairingStatus();
      if (staleRef.current) return;
      setPairing(data);
    } catch (error: unknown) {
      if (staleRef.current) return;
      toast.error(getErrorMessage(error, 'message.getPairingFail'));
      setPairing(null); setLoadError(true);
    } finally { if (!staleRef.current) setLoading(false); }
  };

  const handleRetry = () => {
    if (retryLockRef.current) return;
    retryLockRef.current = true; setLoadError(false);
    fetchPairingStatus().finally(() => { retryLockRef.current = false; });
  };

  const fetchRelationshipData = async (pairingId: string) => {
    setRelationshipLoading(true);
    try {
      const data = await getRelationshipProfile(pairingId);
      if (staleRef.current) return;
      setRelationshipProfile(data);
      setFormValues({
        relationship_stage: toOptionalTrimmed(data?.relationship_stage),
        relationship_duration_days: toOptionalNumber(data?.relationship_duration_days),
        communication_frequency: toOptionalTrimmed(data?.communication_frequency),
        relationship_strengths: toOptionalTrimmed(data?.relationship_strengths),
        relationship_challenges: toOptionalTrimmed(data?.relationship_challenges),
      });
    } catch (error: unknown) {
      if (staleRef.current) return;
      toast.error(getErrorMessage(error, 'message.relationshipProfileLoadFail'));
    } finally { if (!staleRef.current) setRelationshipLoading(false); }
  };

  const handleCreatePairing = async () => {
    if (createLockRef.current) return;
    createLockRef.current = true; setCreating(true);
    try {
      const newPairing = await createPairing();
      if (!mountedRef.current) return;
      setPairing(newPairing); toast.success(t('message.createPairingSuccess'));
    } catch (error: unknown) { toast.error(getErrorMessage(error, 'message.createPairingFail')); }
    finally { createLockRef.current = false; setCreating(false); }
  };

  const handleJoinPairing = async () => {
    if (!inviteCode.trim()) { toast.warning(t('message.enterInviteCode')); return; }
    if (joinLockRef.current) return;
    joinLockRef.current = true; setJoining(true);
    try {
      const joined = await joinPairing(inviteCode.trim());
      if (!mountedRef.current) return;
      setPairing(joined); toast.success(t('message.joinPairingSuccess')); setInviteCode('');
    } catch (error: unknown) { toast.error(getErrorMessage(error, 'message.joinPairingFail')); }
    finally { joinLockRef.current = false; setJoining(false); }
  };

  const handleCopyCode = () => {
    if (pairing?.invite_code) { navigator.clipboard.writeText(pairing.invite_code); toast.success(t('message.copyInviteSuccess')); }
  };

  const handleCancelPairing = async () => {
    setConfirmCancelOpen(false);
    if (cancelLockRef.current) return;
    cancelLockRef.current = true; setCancelling(true);
    try {
      const cancelled = await cancelPairing();
      if (!mountedRef.current) return;
      setPairing(cancelled); toast.success(t('message.cancelPairingSuccess'));
    } catch (error: unknown) { toast.error(getErrorMessage(error, 'message.cancelPairingFail')); }
    finally { cancelLockRef.current = false; setCancelling(false); }
  };

  const handleSaveRelationshipProfile = async () => {
    if (!activePairingId || saveLockRef.current) return;
    saveLockRef.current = true; setRelationshipSaving(true);
    try {
      const payload = buildRelationshipPayload(formValues);
      const saved = await upsertRelationshipProfile(activePairingId, payload);
      if (staleRef.current || !mountedRef.current) return;
      setRelationshipProfile(saved); toast.success(t('message.relationshipProfileSaveSuccess'));
    } catch (error: unknown) {
      if (staleRef.current) return;
      toast.error(getErrorMessage(error, 'message.relationshipProfileSaveFail'));
    } finally { saveLockRef.current = false; if (!staleRef.current) setRelationshipSaving(false); }
  };

  useEffect(() => {
    if (!activePairingId) { setRelationshipProfile(null); setFormValues({}); return; }
    void fetchRelationshipData(activePairingId);
  }, [activePairingId]);

  const startInterviewFlow = async () => {
    if (!activePairingId) return;
    const resumeData = await checkResume();
    if (!mountedRef.current) return;
    const resumePath = getInterviewResumeNavigationPath(resumeData);
    if (resumePath) { navigate(resumePath); return; }
    const session = await startSession('onboarding');
    if (!mountedRef.current) return;
    navigate(`/interview/${session.id}`);
  };

  const handleTriggerAClick = async () => {
    if (!activePairingId) return;
    if (!profile?.consent_given) { setConsentOpen(true); return; }
    try { await startInterviewFlow(); }
    catch (error: unknown) { if (mountedRef.current) toast.error(getErrorMessage(error, 'interview.startFail')); }
  };

  const handleConsent = async () => {
    if (!activePairingId) { setConsentOpen(false); return; }
    try { await giveConsent(); if (!mountedRef.current) return; setConsentOpen(false); await startInterviewFlow(); }
    catch (error: unknown) { if (mountedRef.current) toast.error(getErrorMessage(error, 'interview.startFail')); }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;

  if (loadError) {
    return (
      <ProtectedRoute>
        <div className="mx-auto max-w-lg p-6" role="main" aria-label={t('pairing.pageLabel')}>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
            <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" /><p className="text-sm text-foreground">{t('message.getPairingFail')}</p></div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRetry}>{t('common.retry')}</Button>
              <Button size="sm" onClick={() => navigate('/profile/settings')}>{t('pairing.goToSettings')}</Button>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SEO title={t('pairing.title')} description={t('pairing.description')} />
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="mx-auto max-w-2xl px-4 py-8 md:px-6" role="main" aria-label={t('pairing.pageLabel')}>
        {/* Interview Trigger Banner */}
        {activePairingId && !profile?.consent_given && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-light/50 p-4">
            <Heart className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{t('trigger.bannerTitle')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('trigger.bannerDesc')}</p>
            </div>
            <Button size="sm" onClick={handleTriggerAClick}>{t('trigger.bannerOk')}</Button>
          </div>
        )}

        <ConsentModal open={consentOpen} onConsent={handleConsent} onCancel={() => setConsentOpen(false)} loading={consentLoading} />

        <h2 className="mb-6 text-2xl font-bold text-foreground font-heading">{t('pairing.heading')}</h2>

        {/* Active Pairing */}
        {pairing && pairing.status === 'active' && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-6">
            <div className="flex items-start gap-3 rounded-lg bg-success/5 border border-success/20 p-3">
              <CheckCircle className="mt-0.5 size-5 text-success" />
              <div><p className="text-sm font-medium text-foreground">{t('pairing.pairedTitle')}</p><p className="text-xs text-muted-foreground">{t('pairing.pairedDesc')}</p></div>
            </div>

            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">{t('pairing.pairingInfo')}</p>
              <p className="text-muted-foreground">{t('pairing.pairingId')}{pairing.id}</p>
              {pairing.user1 && <p className="text-muted-foreground">{t('pairing.user1')}{pairing.user1.nickname || pairing.user1.id}</p>}
              {pairing.user2 && <p className="text-muted-foreground">{t('pairing.user2')}{pairing.user2.nickname || pairing.user2.id}</p>}
            </div>

            <div className="border-t border-border pt-6 space-y-4">
              <p className="text-base font-semibold text-foreground">{t('pairing.relationshipTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('pairing.relationshipDesc')}</p>

              {relationshipLoading ? (
                <Loader2 className="size-5 animate-spin text-primary" />
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('pairing.relationshipStage')}</label>
                    <Select value={formValues.relationship_stage || ''} onValueChange={(v: string) => setFormValues((p) => ({ ...p, relationship_stage: v }))}>
                      <SelectTrigger><SelectValue placeholder={t('pairing.relationshipStagePlaceholder')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newly_dating">{t('pairing.relationshipStageNewlyDating')}</SelectItem>
                        <SelectItem value="stable">{t('pairing.relationshipStageStable')}</SelectItem>
                        <SelectItem value="engaged">{t('pairing.relationshipStageEngaged')}</SelectItem>
                        <SelectItem value="married">{t('pairing.relationshipStageMarried')}</SelectItem>
                        <SelectItem value="separated">{t('pairing.relationshipStageSeparated')}</SelectItem>
                        <SelectItem value="other">{t('pairing.relationshipStageOther')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('pairing.relationshipDurationDays')}</label>
                    <Input type="number" min={0} max={36500} placeholder={t('pairing.relationshipDurationDaysPlaceholder')} value={formValues.relationship_duration_days ?? ''} onChange={(e) => setFormValues((p) => ({ ...p, relationship_duration_days: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('pairing.communicationFrequency')}</label>
                    <Input placeholder={t('pairing.communicationFrequencyPlaceholder')} value={formValues.communication_frequency || ''} onChange={(e) => setFormValues((p) => ({ ...p, communication_frequency: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('pairing.relationshipStrengths')}</label>
                    <textarea rows={3} maxLength={1000} placeholder={t('pairing.relationshipStrengthsPlaceholder')} value={formValues.relationship_strengths || ''} onChange={(e) => setFormValues((p) => ({ ...p, relationship_strengths: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('pairing.relationshipChallenges')}</label>
                    <textarea rows={3} maxLength={1000} placeholder={t('pairing.relationshipChallengesPlaceholder')} value={formValues.relationship_challenges || ''} onChange={(e) => setFormValues((p) => ({ ...p, relationship_challenges: e.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                  </div>
                  <Button onClick={handleSaveRelationshipProfile} disabled={relationshipSaving}>
                    {relationshipSaving && <Loader2 className="size-4 animate-spin" />}
                    {t('pairing.saveRelationshipProfile')}
                  </Button>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <Button variant="destructive" size="sm" onClick={() => setConfirmCancelOpen(true)} disabled={cancelling}>
                {t('pairing.cancelPairing')}
              </Button>
            </div>
            <ConfirmModal open={confirmCancelOpen} onCancel={() => setConfirmCancelOpen(false)} onConfirm={handleCancelPairing} title={t('pairing.confirmCancelTitle')} type="danger" confirmText={t('pairing.cancelPairing')}>
              {t('pairing.confirmCancelDesc')}
            </ConfirmModal>
          </div>
        )}

        {/* Pending Pairing */}
        {pairing && pairing.status === 'pending' && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-6">
            <div className="flex items-start gap-3 rounded-lg bg-primary-light/50 border border-primary/20 p-3">
              <AlertCircle className="mt-0.5 size-5 text-primary" />
              <div><p className="text-sm font-medium text-foreground">{t('pairing.pendingTitle')}</p><p className="text-xs text-muted-foreground">{t('pairing.pendingDesc')}</p></div>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">{t('pairing.inviteCode')}</p>
              <div className="flex items-center gap-2">
                <Input value={pairing.invite_code} readOnly className="w-[200px] text-center font-mono text-lg tracking-widest" />
                <Button variant="outline" onClick={handleCopyCode}><Copy className="size-4" />{t('pairing.copy')}</Button>
              </div>
              <p className="text-xs text-muted-foreground">{t('pairing.inviteHint')}</p>
            </div>
          </div>
        )}

        {/* No Pairing */}
        {(!pairing || (pairing.status !== 'active' && pairing.status !== 'pending')) && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-8">
            <div className="space-y-3">
              <h4 className="text-base font-semibold text-foreground">{t('pairing.createTitle')}</h4>
              <p className="text-sm text-muted-foreground">{t('pairing.createDesc')}</p>
              <Button onClick={handleCreatePairing} disabled={creating}>
                {creating ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                {t('pairing.createButton')}
              </Button>
            </div>
            <div className="border-t border-border pt-6 space-y-3">
              <h4 className="text-base font-semibold text-foreground">{t('pairing.joinTitle')}</h4>
              <p className="text-sm text-muted-foreground">{t('pairing.joinDesc')}</p>
              <div className="flex items-center gap-2">
                <Input placeholder={t('pairing.joinPlaceholder')} value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} maxLength={6} className="w-[200px] text-center font-mono text-lg tracking-widest" />
                <Button onClick={handleJoinPairing} disabled={joining}>
                  {joining ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
                  {t('pairing.joinButton')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </ProtectedRoute>
  );
};

export default ProfilePairing;
