/**
 * 設置頁面
 *
 * 遷移: Ant Card/Form/Switch/Button/Typography/Spin/Alert/message → shadcn + Tailwind + sonner
 */

import { useEffect, useState, useRef } from 'react';
import { useMountedRef } from '@/hooks/useMountedRef';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import SEO from '@/components/common/SEO';
import { getProfile, updateProfile } from '@/services/api/user';
import { useAuthStore } from '@/store/authStore';
import { getErrorMessage } from '@/utils/apiError';
import { t } from '@/utils/i18n';

const ProfileSettings = () => {
  const navigate = useNavigate();
  const { updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(true);

  const mountedRef = useMountedRef();
  const staleRef = useRef(false);
  const saveLockRef = useRef(false);
  const retryLockRef = useRef(false);

  useEffect(() => {
    staleRef.current = false;
    const init = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const profile = await getProfile();
        if (staleRef.current) return;
        updateUser(profile);
        setNotificationEnabled(profile.notification_enabled ?? true);
      } catch (error: unknown) {
        if (staleRef.current) return;
        const msg = getErrorMessage(error, 'message.getProfileFail');
        toast.error(msg);
        setLoadError(msg);
      } finally {
        if (!staleRef.current) setLoading(false);
      }
    };
    init();
    return () => { staleRef.current = true; };
  }, [updateUser]);

  const handleSubmit = async () => {
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setSaving(true);
    try {
      const updated = await updateProfile({ notification_enabled: notificationEnabled });
      if (!mountedRef.current) return;
      updateUser(updated);
      toast.success(t('message.saveSuccess'));
    } catch (error: unknown) {
      if (mountedRef.current) toast.error(getErrorMessage(error, 'message.saveFail'));
    } finally {
      saveLockRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  };

  const handleRetry = () => {
    if (retryLockRef.current) return;
    retryLockRef.current = true;
    setLoadError(null);
    setLoading(true);
    getProfile()
      .then((p) => {
        if (staleRef.current) return;
        updateUser(p);
        setNotificationEnabled(p.notification_enabled ?? true);
      })
      .catch((error: unknown) => {
        if (staleRef.current) return;
        const msg = getErrorMessage(error, 'message.getProfileFail');
        toast.error(msg);
        setLoadError(msg);
      })
      .finally(() => {
        retryLockRef.current = false;
        if (!staleRef.current) setLoading(false);
      });
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      </ProtectedRoute>
    );
  }

  if (loadError) {
    return (
      <ProtectedRoute>
        <div className="mx-auto max-w-lg p-6">
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="text-sm text-foreground">{loadError}</p>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={handleRetry}>{t('common.retry')}</Button>
                <Button size="sm" onClick={() => navigate('/profile/index')}>{t('settings.goToProfile')}</Button>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SEO title={t('settings.title')} description={t('settings.description')} />
      <div className="mx-auto max-w-lg px-4 py-8" role="main" aria-label={t('settings.pageLabel')}>
        <h2 className="mb-6 text-2xl font-bold tracking-tight text-foreground font-heading">
          {t('settings.heading')}
        </h2>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-semibold text-foreground">{t('settings.notification')}</h3>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-foreground">{t('settings.enableNotification')}</span>
            <button
              type="button"
              role="switch"
              aria-checked={notificationEnabled}
              onClick={() => setNotificationEnabled(!notificationEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                notificationEnabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  notificationEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>

          <div className="mt-6">
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {t('settings.save')}
            </Button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default ProfileSettings;
