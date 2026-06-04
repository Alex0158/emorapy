import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '@/utils/i18n';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from './dialog';
import { Sheet, SheetContent, SheetTitle } from './sheet';

async function setLocaleReady(locale: 'zh-TW' | 'en-US'): Promise<void> {
  setLocale(locale);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('dialog and sheet i18n', () => {
  beforeEach(() => {
    setLocale('zh-TW');
  });

  it('Dialog close controls use the current locale', async () => {
    const { unmount } = render(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>測試標題</DialogTitle>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    );

    expect(screen.getAllByRole('button', { name: '關閉' })).toHaveLength(2);
    unmount();

    await setLocaleReady('en-US');
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Test title</DialogTitle>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    );

    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2);
  });

  it('Sheet close control uses the current locale', async () => {
    const { unmount } = render(
      <Sheet open>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>測試標題</SheetTitle>
        </SheetContent>
      </Sheet>
    );

    expect(screen.getByRole('button', { name: '關閉' })).toBeInTheDocument();
    unmount();

    await setLocaleReady('en-US');
    render(
      <Sheet open>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>Test title</SheetTitle>
        </SheetContent>
      </Sheet>
    );

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
