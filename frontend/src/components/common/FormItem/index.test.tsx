/**
 * FormItem 組件單元測試
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FormItem from './index';

describe('FormItem', () => {
  it('應渲染 children 和 label', () => {
    render(
      <FormItem name="field" label="標籤">
        <input data-testid="input" />
      </FormItem>
    );
    expect(screen.getByTestId('input')).toBeInTheDocument();
    expect(screen.getByText('標籤')).toBeInTheDocument();
  });

  it('應有 mb-4 間距類名', () => {
    const { container } = render(
      <FormItem name="a" label="A">
        <input />
      </FormItem>
    );
    expect(container.firstElementChild?.className).toContain('mb-4');
  });

  it('required 時顯示 * 標記', () => {
    render(
      <FormItem name="a" label="A" required>
        <input />
      </FormItem>
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });
});
