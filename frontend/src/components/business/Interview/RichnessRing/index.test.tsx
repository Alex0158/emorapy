/**
 * RichnessRing 組件單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RichnessRing from './index';

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));

describe('RichnessRing', () => {
  it('score < 0.05 時應顯示 notStarted 標籤', () => {
    render(<RichnessRing score={0} />);
    expect(screen.getByText('psychProfile.richnessNotStarted')).toBeInTheDocument();
  });

  it('score < 0.05 但已有面向進度時應顯示 earlyStage 標籤', () => {
    render(<RichnessRing score={0.02} hasDomainProgress />);
    expect(screen.getByText('psychProfile.richnessEarlyStage')).toBeInTheDocument();
  });

  it('score 0.1 時應顯示 gettingToKnow 標籤', () => {
    render(<RichnessRing score={0.1} />);
    expect(screen.getByText('psychProfile.richnessGettingToKnow')).toBeInTheDocument();
  });

  it('score 0.5 時應顯示 goodUnderstanding 標籤', () => {
    render(<RichnessRing score={0.5} />);
    expect(screen.getByText('psychProfile.richnessGoodUnderstanding')).toBeInTheDocument();
  });

  it('score 0.8 時應顯示 deepUnderstanding 標籤', () => {
    render(<RichnessRing score={0.8} />);
    expect(screen.getByText('psychProfile.richnessDeepUnderstanding')).toBeInTheDocument();
  });

  it('showLabel=false 時不應渲染外部標籤文字', () => {
    const { container } = render(<RichnessRing score={0.5} showLabel={false} />);
    expect(container.querySelector('.richness-ring__label')).not.toBeInTheDocument();
  });
});
