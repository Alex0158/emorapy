/**
 * 網絡狀態監控組件
 *
 * 遷移: Ant Alert/message/Icons → shadcn Alert + sonner + Lucide
 */

import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { WifiOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { t } from '@/utils/i18n';

const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        toast.success(t('networkStatus.restored'));
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] p-3">
      <Alert className="border-warning/30 bg-warning/5">
        <WifiOff className="size-4" />
        <AlertTitle>{t('networkStatus.offline')}</AlertTitle>
        <AlertDescription>{t('networkStatus.offlineDesc')}</AlertDescription>
      </Alert>
    </div>
  );
};

export default NetworkStatus;
