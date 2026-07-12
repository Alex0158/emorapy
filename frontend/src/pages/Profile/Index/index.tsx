/**
 * 個人資料頁面
 *
 * 遷移: Ant Card/Form/Input/Button/Typography/Upload/Avatar/Space/Spin/Tag/Progress/Alert/Icons/message
 *       → shadcn + Tailwind + sonner + Lucide
 * 保留: 所有業務邏輯（profile fetch/update, avatar upload, psych profile, interview trigger）
 * 保留: ConsentModal 業務組件
 */

import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { User, Upload, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getProfile, updateProfile, uploadAvatar } from '@/services/api/user';
import { useAuthStore } from '@/store/authStore';
import { MAX_FILE_SIZE } from '@/utils/constants';
import { formatFileSize } from '@/utils/format';
import { getErrorMessage } from '@/utils/apiError';
import { getInterviewResumeNavigationPath } from '@/utils/interviewResume';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import ConsentModal from '@/components/business/Interview/ConsentModal';
import { usePsychProfileStore } from '@/store/psychProfileStore';
import { useInterviewStore } from '@/store/interviewStore';
import { getDomainLabel } from '@/types/interview';
import type { PsychDomain } from '@/types/interview';
import { t } from '@/utils/i18n';
import axios from 'axios';

const ProfileIndex = () => {
  const { user, updateUser } = useAuthStore();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const navigate = useNavigate();
  const { profile: psychProfile, fetchProfile: fetchPsychProfile, giveConsent, consentLoading } = usePsychProfileStore();
  const { startSession, checkResume } = useInterviewStore();

  const mountedRef = useMountedRef();
  const staleRef = useRef(false);
  const fetchLockRef = useRef(false);
  const continueLockRef = useRef(false);
  const submitLockRef = useRef(false);

  useEffect(() => {
    staleRef.current = false;
    fetchProfileData();
    fetchPsychProfile();
    return () => { staleRef.current = true; };
  }, []);

  const fetchProfileData = async () => {
    if (fetchLockRef.current) return;
    fetchLockRef.current = true; setLoading(true); setLoadError(null);
    try {
      const profile = await getProfile();
      if (staleRef.current) return;
      setNickname(profile.nickname || '');
      updateUser(profile);
    } catch (error: unknown) {
      if (staleRef.current) return;
      const msg = getErrorMessage(error, 'message.getProfileIndexFail');
      toast.error(msg); setLoadError(msg);
    } finally { fetchLockRef.current = false; if (!staleRef.current) setLoading(false); }
  };

  const handleSubmit = async () => {
    if (submitLockRef.current) return;
    submitLockRef.current = true; setSaving(true);
    try {
      const updatedUser = await updateProfile({ nickname });
      if (!mountedRef.current) return;
      updateUser(updatedUser); toast.success(t('message.profileUpdateSuccess'));
    } catch (error: unknown) {
      if (mountedRef.current) toast.error(getErrorMessage(error, 'message.updateFail'));
    } finally { submitLockRef.current = false; if (mountedRef.current) setSaving(false); }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error(t('message.avatarOnlyImage')); return; }
    if (file.size > MAX_FILE_SIZE) { toast.error(t('message.avatarSizeLimit').replace('{size}', formatFileSize(MAX_FILE_SIZE))); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const updatedUser = await uploadAvatar(formData);
      if (!mountedRef.current) return;
      updateUser(updatedUser); toast.success(t('message.avatarSuccess'));
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      if (axios.isAxiosError(err) && err.response) return;
      toast.error(getErrorMessage(err, 'message.avatarUploadFail'));
    } finally { if (mountedRef.current) setUploading(false); }
  };

  const handleContinueInterview = async () => {
    if (continueLockRef.current) return;
    continueLockRef.current = true;
    try {
      const resumeData = await checkResume();
      if (!mountedRef.current) return;
      const resumePath = getInterviewResumeNavigationPath(resumeData);
      if (resumePath) { navigate(resumePath); return; }
      const session = await startSession('organic');
      if (!mountedRef.current) return;
      navigate(`/interview/${session.id}`);
    } catch (error: unknown) {
      if (mountedRef.current) toast.error(getErrorMessage(error, 'interview.startFail'));
    } finally { continueLockRef.current = false; }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <SEO title={t('profileIndex.title')} description={t('profileIndex.description')} />
        <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-busy="true" aria-label={t('common.loading')}>
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SEO title={t('profileIndex.title')} description={t('profileIndex.description')} />
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6" role="main" aria-label={t('profileIndex.pageLabel')}>
        <h2 className="mb-6 text-2xl font-bold text-foreground font-heading">{t('profileIndex.heading')}</h2>

        {/* Error */}
        {loadError && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="flex-1"><p className="text-sm text-foreground">{loadError}</p></div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchProfileData()} data-testid="profile-index-load-retry">{t('common.retry')}</Button>
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>{t('common.back')}</Button>
            </div>
          </div>
        )}

        {/* Profile Card */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6 space-y-6" aria-label={t('profileIndex.formLabel')}>
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <Avatar className="size-20 shadow-sm">
              <AvatarImage src={user?.avatar_url} />
              <AvatarFallback className="text-xl"><User className="size-8" /></AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <label className="relative cursor-pointer">
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} />
                <Button variant="outline" size="sm" asChild disabled={uploading}>
                  <span>{uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}{t('profileIndex.uploadAvatar')}</span>
                </Button>
              </label>
              <p className="text-xs text-muted-foreground">{t('profileIndex.avatarHint')}</p>
            </div>
          </div>

          {/* Nickname */}
          <div className="space-y-2">
            <label htmlFor="profile-nickname" className="text-sm font-medium text-foreground">{t('profileIndex.nicknameLabel')}</label>
            <Input id="profile-nickname" autoComplete="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t('profileIndex.nicknamePlaceholder')} maxLength={20} className="h-11 rounded-xl" />
          </div>

          {/* Email (readonly) */}
          <div className="space-y-2">
            <label htmlFor="profile-email" className="text-sm font-medium text-foreground">{t('profileIndex.emailLabel')}</label>
            <Input id="profile-email" autoComplete="email" value={user?.email || ''} disabled className="h-11 rounded-xl bg-muted/50" />
          </div>

          {/* Save */}
          <div className="text-center pt-2">
            <Button onClick={handleSubmit} disabled={saving} aria-label={t('profileIndex.saveAria')}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {t('profileIndex.save')}
            </Button>
          </div>
        </div>

        {/* Psych Profile / My Story */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground font-heading">{t('psychProfile.myStory')}</h3>
            <p className="max-w-2xl text-sm text-muted-foreground">{t('consent.description')}</p>
            {psychProfile?.consent_given && (
              <p className="text-xs text-muted-foreground">{t('psychProfile.disclaimer')}</p>
            )}
          </div>

          {!psychProfile?.consent_given ? (
            <div className="text-center py-6">
              <Button onClick={() => setConsentOpen(true)}>{t('psychProfile.chatForFive')}</Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-lg border border-border p-5">
                <div>
                  <p className="text-sm font-semibold text-foreground mb-2">{t('psychProfile.exploredDomains')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(Array.isArray(psychProfile.narratives) ? psychProfile.narratives.filter(n => n.is_latest && n.completeness > 0) : []).map(n => (
                      <Badge key={n.domain} variant="secondary" className="text-xs">{getDomainLabel(n.domain as PsychDomain)}</Badge>
                    ))}
                    {(!Array.isArray(psychProfile.narratives) || psychProfile.narratives.filter(n => n.is_latest && n.completeness > 0).length === 0) && (
                      <span className="text-xs text-muted-foreground">{t('psychProfile.noExplored')}</span>
                    )}
                  </div>
                </div>
              </div>

              {Array.isArray(psychProfile.insights) && psychProfile.insights.filter(i => i.is_active).length > 0 && (
                <div className="rounded-lg border border-border p-5 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">{t('psychProfile.keyInsights')}</p>
                  {psychProfile.insights.filter(i => i.is_active).slice(0, 3).map(i => (
                    <div key={i.id} className="border-l-2 border-primary/25 py-1 pl-3">
                      <span className="text-sm text-foreground"><span className="font-medium">{i.key}</span>：{i.value}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleContinueInterview}>{t('psychProfile.continueChat')}</Button>
                <Button variant="ghost" onClick={() => navigate('/profile/my-story')}>{t('psychProfile.manageMyData')}</Button>
              </div>
            </div>
          )}
        </div>

        <ConsentModal
          open={consentOpen}
          onConsent={async () => {
            try {
              await giveConsent();
              if (!mountedRef.current) return;
              setConsentOpen(false);
              const resumeData = await checkResume();
              if (!mountedRef.current) return;
              const resumePath = getInterviewResumeNavigationPath(resumeData);
              if (resumePath) { navigate(resumePath); return; }
              const session = await startSession('onboarding');
              if (!mountedRef.current) return;
              navigate(`/interview/${session.id}`);
            } catch (error: unknown) { if (mountedRef.current) toast.error(getErrorMessage(error, 'interview.startFail')); }
          }}
          onCancel={() => setConsentOpen(false)}
          loading={consentLoading}
        />
      </div>
    </ProtectedRoute>
  );
};

export default ProfileIndex;
