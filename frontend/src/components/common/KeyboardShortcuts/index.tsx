/**
 * 鍵盤快捷鍵組件（遷移：Ant Modal/Typography/Tag → shadcn Dialog + Badge + Tailwind）
 */

import { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { t } from '@/utils/i18n';

interface Shortcut {
  key: string;
  description: string;
  action: () => void;
}

interface KeyboardShortcutsProps {
  shortcuts: Shortcut[];
  showHelp?: boolean;
}

const KeyboardShortcuts = ({ shortcuts, showHelp = true }: KeyboardShortcutsProps) => {
  const [helpVisible, setHelpVisible] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (showHelp) setHelpVisible(true);
      }
      shortcuts.forEach((shortcut) => {
        const keys = shortcut.key.toLowerCase().split('+');
        const ctrl = keys.includes('ctrl') || keys.includes('cmd');
        const shift = keys.includes('shift');
        const alt = keys.includes('alt');
        const key = keys[keys.length - 1];
        if ((ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey) && (shift ? e.shiftKey : !e.shiftKey) && (alt ? e.altKey : !e.altKey) && e.key.toLowerCase() === key) {
          e.preventDefault();
          shortcut.action();
        }
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, showHelp]);

  const formatKey = (key: string): string =>
    key.split('+').map((k) => {
      if (k === 'ctrl' || k === 'cmd') return '⌘';
      if (k === 'shift') return '⇧';
      if (k === 'alt') return '⌥';
      return k.toUpperCase();
    }).join(' + ');

  return (
    <>
      {showHelp && (
        <Dialog open={helpVisible} onOpenChange={setHelpVisible}>
          <DialogContent className="max-w-md" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HelpCircle className="size-5" />{t('keyboard.title')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">{t('keyboard.generalTitle')}</h4>
              <div className="space-y-2">
                {shortcuts.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <Badge variant="outline" className="font-mono text-xs">{formatKey(shortcut.key)}</Badge>
                    <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t('keyboard.helpHint')}</p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default KeyboardShortcuts;
