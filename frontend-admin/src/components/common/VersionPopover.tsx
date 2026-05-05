import { Info, Loader2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { getVersionSnapshot, type VersionRow } from '@/utils/versionInfo';

function VersionRowItem({ row }: { row: VersionRow }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-xs text-muted-foreground">{row.name}</span>
      <span className={cn('text-xs', row.status === 'ok' && 'font-semibold', row.status === 'error' && 'text-destructive')}>
        {row.version}
      </span>
    </div>
  );
}

export default function VersionPopover() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<VersionRow[]>([]);

  const loadVersions = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const snapshot = await getVersionSnapshot();
      setRows(snapshot.rows);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const content = useMemo(() => {
    if (loading && rows.length === 0) {
      return (
        <div className="flex min-h-8 min-w-60 items-center justify-center">
          <Loader2 className="size-4 animate-spin" />
        </div>
      );
    }

    return (
      <div className="flex min-w-64 flex-col gap-2">
        {rows.map((row) => (
          <div key={row.name}>
            <VersionRowItem row={row} />
            {row.message && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{row.message}</p>
            )}
          </div>
        ))}
      </div>
    );
  }, [loading, rows]);

  return (
    <Popover open={open} onOpenChange={(nextOpen: boolean) => { setOpen(nextOpen); if (nextOpen) void loadVersions(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Info className="size-3.5" />版本
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <p className="mb-2 text-sm font-medium">版本資訊</p>
        {content}
      </PopoverContent>
    </Popover>
  );
}
