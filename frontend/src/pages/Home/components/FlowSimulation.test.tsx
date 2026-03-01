/**
 * FlowSimulation 組件 smoke 測試
 * 此組件為重度動畫展示組件（1300+ 行），在 jsdom 中僅驗證不拋錯與基礎結構。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/utils/i18n', () => ({
  getLocale: () => 'zh-TW',
  t: (key: string) => key,
}));

vi.mock('framer-motion', () => {
  const React = require('react');
  const stripMotionProps = (props: Record<string, unknown>) => {
    const {
      animate,
      initial,
      exit,
      variants,
      transition,
      layout,
      layoutId,
      viewport,
      whileInView,
      whileHover,
      whileTap,
      ...rest
    } = props;
    return rest;
  };
  const forward = (name: string) =>
    React.forwardRef((props: Record<string, unknown>, ref: unknown) =>
      React.createElement('div', { ...stripMotionProps(props), ref, 'data-motion': name }, props.children));
  const motion = new Proxy({}, {
    get: (_target: unknown, prop: string) => forward(`motion.${prop}`),
  });
  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  };
});

import FlowSimulation from './FlowSimulation';

describe('FlowSimulation', () => {
  it('應渲染不拋錯並顯示標題', () => {
    render(<FlowSimulation />);
    expect(screen.getByText('模擬實際使用流程')).toBeInTheDocument();
  });

  it('應渲染 5 個步驟', () => {
    render(<FlowSimulation />);
    expect(screen.getByText('發起溝通')).toBeInTheDocument();
    expect(screen.getByText('雙向聆聽')).toBeInTheDocument();
    expect(screen.getByText('心理師分析')).toBeInTheDocument();
    expect(screen.getByText('個別開解')).toBeInTheDocument();
    expect(screen.getByText('和好行動')).toBeInTheDocument();
  });

  it('應渲染兩個手機裝置標籤', () => {
    render(<FlowSimulation />);
    expect(screen.getByText('用戶 A的設備')).toBeInTheDocument();
    expect(screen.getByText('用戶 B的設備')).toBeInTheDocument();
  });
});
