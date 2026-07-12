/**
 * FeedbackCard 組件單元測試
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FeedbackCardComponent from './index';
import type { FeedbackCard } from '@/types/interview';

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}));
vi.mock('@/types/interview', () => ({
  getDomainLabel: (d: string) => `label:${d}`,
}));
const baseFeedback: FeedbackCard = {
  summary: '心理回饋摘要',
  domains_explored: ['attachment', 'personality'],
  domains_unexplored: ['family_origin', 'life_events'],
  key_insights: ['洞察1', '洞察2'],
  richness_score: 0.65,
  encouragement: '你做得很好！',
  continuation_hint: '下次我們可以聊聊原生家庭的部分。',
};

describe('FeedbackCardComponent', () => {
  it('應渲染 summary、已談及面向、insights、encouragement 與 continuation_hint', () => {
    render(<FeedbackCardComponent feedback={baseFeedback} />);
    expect(screen.getByText('心理回饋摘要')).toBeInTheDocument();
    expect(screen.getByText('label:attachment')).toBeInTheDocument();
    expect(screen.getByText('label:personality')).toBeInTheDocument();
    expect(screen.getByText(/psychProfile\.exploredDomains/)).toBeInTheDocument();
    expect(screen.queryByText(/psychProfile\.unexploredDomains/)).not.toBeInTheDocument();
    expect(screen.queryByText('label:family_origin')).not.toBeInTheDocument();
    expect(screen.queryByText('label:life_events')).not.toBeInTheDocument();
    expect(screen.getByText('洞察1')).toBeInTheDocument();
    expect(screen.getByText('洞察2')).toBeInTheDocument();
    expect(screen.getByText('你做得很好！')).toBeInTheDocument();
    expect(screen.getByText('下次我們可以聊聊原生家庭的部分。')).toBeInTheDocument();
    expect(screen.getByText('psychProfile.disclaimer')).toBeInTheDocument();
    expect(screen.queryByTestId('richness-ring')).not.toBeInTheDocument();
  });

  it('trigger=post_judgment 時主按鈕應為 backToJudgment', () => {
    const onClick = vi.fn();
    render(
      <FeedbackCardComponent
        feedback={baseFeedback}
        trigger="post_judgment"
        onBackToJudgment={onClick}
      />
    );
    fireEvent.click(screen.getByText('feedback.backToJudgment'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('trigger=pre_case 時主按鈕應為 continueSubmit', () => {
    const onClick = vi.fn();
    render(
      <FeedbackCardComponent
        feedback={baseFeedback}
        trigger="pre_case"
        onBackToCase={onClick}
      />
    );
    fireEvent.click(screen.getByText('feedback.continueSubmit'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('預設 trigger 時主按鈕應為 backToHome', () => {
    const onClick = vi.fn();
    render(
      <FeedbackCardComponent feedback={baseFeedback} onGoHome={onClick} />
    );
    fireEvent.click(screen.getByText('feedback.backToHome'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('有 onViewProfile 時應渲染 viewMyStory 按鈕', () => {
    const onClick = vi.fn();
    render(
      <FeedbackCardComponent feedback={baseFeedback} onViewProfile={onClick} />
    );
    fireEvent.click(screen.getByText('feedback.viewMyStory'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('無 key_insights 時不應渲染洞察區塊', () => {
    const feedback = { ...baseFeedback, key_insights: undefined as never };
    render(<FeedbackCardComponent feedback={feedback} />);
    expect(screen.queryByText('psychProfile.keyInsights')).not.toBeInTheDocument();
  });
});
