/**
 * FormItem 組件單元測試
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Form } from 'antd';
import FormItem from './index';

describe('FormItem', () => {
  it('應渲染 children', () => {
    render(
      <Form>
        <FormItem name="field" label="標籤">
          <input data-testid="input" />
        </FormItem>
      </Form>
    );
    expect(screen.getByTestId('input')).toBeInTheDocument();
    expect(screen.getByText('標籤')).toBeInTheDocument();
  });

  it('預設應有 error-inline 類名', () => {
    const { container } = render(
      <Form>
        <FormItem name="a" label="A">
          <input />
        </FormItem>
      </Form>
    );
    const item = container.querySelector('.enhanced-form-item.error-inline');
    expect(item).toBeInTheDocument();
  });

  it('showErrorInline 為 false 時不應有 error-inline 類名', () => {
    const { container } = render(
      <Form>
        <FormItem name="a" label="A" showErrorInline={false}>
          <input />
        </FormItem>
      </Form>
    );
    const item = container.querySelector('.enhanced-form-item');
    expect(item).toBeInTheDocument();
    expect(item?.classList.contains('error-inline')).toBe(false);
  });
});
