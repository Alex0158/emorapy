import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '@/utils/i18n';
import { Dialog, DialogFooter } from './dialog';

const uiDir = path.resolve(import.meta.dirname);

describe('admin dialog and sheet i18n', () => {
  afterEach(() => {
    setLocale('zh-TW');
  });

  it('DialogFooter fallback close button uses the current locale', () => {
    setLocale('zh-TW');
    expect(renderToStaticMarkup(<Dialog open><DialogFooter showCloseButton /></Dialog>)).toContain('關閉');

    setLocale('en-US');
    expect(renderToStaticMarkup(<Dialog open><DialogFooter showCloseButton /></Dialog>)).toContain('Close');
  });

  it('Dialog and Sheet icon close labels are not hardcoded English', () => {
    const dialogSource = fs.readFileSync(path.join(uiDir, 'dialog.tsx'), 'utf8');
    const sheetSource = fs.readFileSync(path.join(uiDir, 'sheet.tsx'), 'utf8');

    expect(dialogSource).toContain('t("common.close")');
    expect(sheetSource).toContain('t("common.close")');
    expect(dialogSource).not.toContain('<span className="sr-only">Close</span>');
    expect(sheetSource).not.toContain('<span className="sr-only">Close</span>');
  });
});
