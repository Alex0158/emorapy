import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SEO from '@/components/common/SEO';
import { useAdminSession } from '@/hooks/useAdminSession';
import { useAdminToken } from '@/hooks/useAdminToken';
import { deriveAdminTokenStatus } from '@/utils/adminTokenState';
import { t } from '@/utils/i18n';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const token = useAdminToken();
  const tokenState = deriveAdminTokenStatus(token);
  const { loginMutation } = useAdminSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (tokenState.tokenReady) {
    return <Navigate to="/admin/ops/jobs" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginMutation.mutateAsync({ email, password });
      toast.success(t('admin.login.success'));
      navigate('/admin/ops/jobs', { replace: true });
    } catch {
      toast.error(t('admin.login.failed'));
    }
  };

  return (
    <>
      <SEO title={t('admin.login.title')} description={t('admin.login.subtitle')} />
      <div className="mx-auto mt-10 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{t('admin.login.heading')}</CardTitle>
            <CardDescription>{t('admin.login.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {tokenState.tokenFormatInvalid && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
                <p className="text-sm text-foreground">{t('admin.login.invalidHint')}</p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('admin.login.email')}</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('admin.login.password')}</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                {t('admin.login.submit')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
