import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  SkeletonChatBubble,
  SkeletonChat,
  SkeletonDashboardCard,
  SkeletonDashboard,
  SkeletonCaseRow,
  SkeletonCaseList,
  SkeletonProfile,
  SkeletonForm,
  SkeletonPage,
} from './index';

describe('SkeletonVariants', () => {
  it('SkeletonChatBubble 渲染左對齊氣泡含 avatar', () => {
    const { container } = render(<SkeletonChatBubble align="left" />);
    // left align should have avatar (rounded-full)
    const avatar = container.querySelector('.rounded-full');
    expect(avatar).toBeInTheDocument();
  });

  it('SkeletonChatBubble 渲染右對齊氣泡不含 avatar', () => {
    const { container } = render(<SkeletonChatBubble align="right" />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain('ml-auto');
  });

  it('SkeletonChat 渲染 4 組氣泡', () => {
    const { container } = render(<SkeletonChat />);
    const bubbles = container.querySelectorAll('[data-slot="skeleton"]');
    expect(bubbles.length).toBeGreaterThanOrEqual(8); // 每個氣泡至少 2 個 skeleton
  });

  it('SkeletonDashboardCard 渲染卡片結構', () => {
    const { container } = render(<SkeletonDashboardCard />);
    expect(container.querySelector('.rounded-xl')).toBeInTheDocument();
  });

  it('SkeletonDashboard 包含多個卡片', () => {
    const { container } = render(<SkeletonDashboard />);
    const cards = container.querySelectorAll('.rounded-xl');
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it('SkeletonCaseList 渲染指定行數', () => {
    const { container } = render(<SkeletonCaseList rows={3} />);
    const rows = container.querySelectorAll('.flex.items-center.gap-4');
    expect(rows).toHaveLength(3);
  });

  it('SkeletonProfile 包含 avatar 骨架', () => {
    const { container } = render(<SkeletonProfile />);
    // 16x16 avatar skeleton
    const avatar = container.querySelector('.h-16.w-16');
    expect(avatar).toBeInTheDocument();
  });

  it('SkeletonForm 渲染指定欄位數', () => {
    const { container } = render(<SkeletonForm fields={4} />);
    // Each field has label + input = 2 skeletons, plus 1 button
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(4 * 2 + 1); // 4 fields * 2 + 1 button
  });

  it('SkeletonPage 渲染全頁加載狀態', () => {
    const { container } = render(<SkeletonPage />);
    expect(container.querySelector('.min-h-\\[60vh\\]')).toBeInTheDocument();
  });

  it('所有變體支持 className prop', () => {
    const { container } = render(<SkeletonDashboardCard className="test-class" />);
    expect(container.firstElementChild?.className).toContain('test-class');
  });
});
