/**
 * 表單項組件（增強版，帶驗證提示）
 */

import { Form } from 'antd';
import type { FormItemProps } from 'antd/es/form';
import type { ReactNode } from 'react';
import './FormItem.less';

interface EnhancedFormItemProps extends FormItemProps {
  children: ReactNode;
  showErrorInline?: boolean;
}

const FormItem = ({ showErrorInline = true, ...props }: EnhancedFormItemProps) => {
  return (
    <Form.Item
      {...props}
      className={`enhanced-form-item ${showErrorInline ? 'error-inline' : ''}`}
    >
      {props.children}
    </Form.Item>
  );
};

export default FormItem;

