/**
 * 版本信息 Popover（遷移：Ant Popover/Button/Typography/Spin → shadcn Popover + Tailwind）
 */

import { Info, Loader2 } from 'lucide-react';
import { t } from '@/utils/i18n';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getVersionSnapshot, type VersionRow } from '@/utils/versionInfo';
import { cn } from '@/lib/utils';

function VersionRowItem({ row }: { row: VersionRow }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{t(`versionInfo.service.${row.service}`)}</span>
      <span className={cn('text-xs font-medium', row.status === 'error' ? 'text-destructive' : 'text-foreground')}>
        {row.version ?? t('versionInfo.readFailed')}
      </span>
    </div>
  );
}

export default function VersionPopover() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<VersionRow[]>([]);

  const loadVersions = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try { setRows((await getVersionSnapshot()).rows); }
    finally { setLoading(false); }
  }, [loading]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => void loadVersions()}>
          <Info className="size-3.5" />{t('common.version')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56">
        <p className="text-xs font-semibold text-foreground mb-2">{t('common.versionInfo')}</p>
        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-2"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-1">
            {rows.map((row) => (
              <div key={row.service}>
                <VersionRowItem row={row} />
                {row.messageKey && <p className="text-[10px] text-muted-foreground pl-1">{t(row.messageKey)}</p>}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
