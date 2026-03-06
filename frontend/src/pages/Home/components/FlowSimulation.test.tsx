/**
 * FlowSimulation 組件 smoke 測試
 * 此組件為重度動畫展示組件（1300+ 行），在 jsdom 中僅驗證不拋錯與基礎結構。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/utils/i18n', () => ({
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
    expect(screen.getByText('flowSim.title')).toBeInTheDocument();
  });

  it('應渲染 5 個步驟', () => {
    render(<FlowSimulation />);
    expect(screen.getByText('flowSim.step1.title')).toBeInTheDocument();
    expect(screen.getByText('flowSim.step2.title')).toBeInTheDocument();
    expect(screen.getByText('flowSim.step3.title')).toBeInTheDocument();
    expect(screen.getByText('flowSim.step4.title')).toBeInTheDocument();
    expect(screen.getByText('flowSim.step5.title')).toBeInTheDocument();
  });

  it('應渲染兩個手機裝置標籤', () => {
    render(<FlowSimulation />);
    expect(screen.getByText(/flowSim\.phone\.roleA/)).toBeInTheDocument();
    expect(screen.getByText(/flowSim\.phone\.roleB/)).toBeInTheDocument();
  });
});
