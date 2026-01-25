/**
 * 陳述輸入組件（增強版）
 */

import { Input, Typography, Tooltip } from 'antd';
import { QuestionCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { validateStatement } from '@/utils/validate';
import { MAX_STATEMENT_LENGTH } from '@/utils/constants';
import { formatWordCount } from '@/utils/format';
import './StatementInput.less';

const { TextArea } = Input;
const { Text } = Typography;

interface StatementInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  role?: 'plaintiff' | 'defendant';
  showGuide?: boolean;
  autoFocus?: boolean;
  onValidationChange?: (isValid: boolean) => void;
  minLength?: number;
  allowEmpty?: boolean;
}

const StatementInput = ({
  value,
  onChange,
  placeholder = '請詳細描述發生了什麼事，你的感受，以及你希望對方怎麼做...',
  label,
  role = 'plaintiff',
  showGuide = true,
  autoFocus = false,
  onValidationChange,
  minLength = MIN_STATEMENT_LENGTH,
  allowEmpty = false,
}: StatementInputProps) => {
  const [focused, setFocused] = useState(false);
  const [validation, setValidation] = useState<{ valid: boolean; message?: string }>({
    valid: false,
  });

  useEffect(() => {
    const trimmed = value.trim();
    if (allowEmpty && trimmed.length === 0) {
      const result = { valid: true, message: undefined };
      setValidation(result);
      onValidationChange?.(result.valid);
      return;
    }
    const result = validateStatement(value, minLength);
    setValidation(result);
    onValidationChange?.(result.valid);
  }, [value, onValidationChange, allowEmpty, minLength]);

  const wordCount = value.trim().length;
  const isComplete = validation.valid;
  const isEmptyAllowed = allowEmpty && wordCount === 0;

  return (
    <div className={`statement-input-wrapper ${role} ${focused ? 'focused' : ''}`}>
      {label && (
        <div className="statement-label">
          <Text strong>{label}</Text>
        </div>
      )}

      {showGuide && (
        <div className={`guide-questions ${focused ? 'visible' : ''}`}>
          <div className="guide-item">
            <QuestionCircleOutlined className="guide-icon" />
            <Text type="secondary">發生了什麼事？</Text>
          </div>
          <div className="guide-item">
            <QuestionCircleOutlined className="guide-icon" />
            <Text type="secondary">你的感受是什麼？</Text>
          </div>
          <div className="guide-item">
            <QuestionCircleOutlined className="guide-icon" />
            <Text type="secondary">你希望對方怎麼做？</Text>
          </div>
        </div>
      )}

      <div className="input-wrapper">
        <TextArea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={10}
          maxLength={MAX_STATEMENT_LENGTH}
          showCount
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="statement-textarea"
        />

        <div className="validation-status">
          {wordCount > 0 && (
            <div className={`status-icon ${isComplete ? 'valid' : 'invalid'}`}>
              {isComplete ? (
                <Tooltip title="字數符合要求">
                  <CheckCircleOutlined />
                </Tooltip>
              ) : (
                <Tooltip title={validation.message}>
                  <CloseCircleOutlined />
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={`word-count ${isComplete ? 'success' : isEmptyAllowed ? 'default' : wordCount < minLength ? 'warning' : 'default'}`}>
        {isEmptyAllowed ? '可留空' : validation.message || formatWordCount(wordCount, MAX_STATEMENT_LENGTH)}
      </div>
    </div>
  );
};

export default StatementInput;
