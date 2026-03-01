import React, { useState, useRef } from 'react';
import { Input, Button, Space, Typography } from 'antd';
import { SendOutlined, StopOutlined, ForwardOutlined } from '@ant-design/icons';
import { t } from '@/utils/i18n';
import './index.less';

const { TextArea } = Input;
const { Text } = Typography;

const MAX_CHARS = 2000;

interface InterviewInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  onSkip?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
}

const InterviewInput: React.FC<InterviewInputProps> = ({
  onSend,
  onStop,
  onSkip,
  disabled,
  isStreaming,
  placeholder,
}) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const charCount = value.length;
  const isOverLimit = charCount > MAX_CHARS;

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isStreaming || isOverLimit) return;
    onSend(trimmed);
    setValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="interview-input">
      <div className="interview-input__area">
        <TextArea
          ref={inputRef as unknown as React.RefObject<import('antd/es/input/TextArea').TextAreaRef>}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t('interview.sendPlaceholder')}
          disabled={disabled || isStreaming}
          autoSize={{ minRows: 2, maxRows: 4 }}
          className="interview-input__textarea"
          status={isOverLimit ? 'error' : undefined}
          style={{ minHeight: 64 }}
        />
        {charCount > MAX_CHARS * 0.8 && (
          <Text
            type={isOverLimit ? 'danger' : 'secondary'}
            className="interview-input__counter"
          >
            {charCount}/{MAX_CHARS}
          </Text>
        )}
      </div>
      <Space>
        {isStreaming && onStop ? (
          <Button
            type="default"
            icon={<StopOutlined />}
            onClick={onStop}
            danger
          >
            {t('interview.stop')}
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!value.trim() || disabled || isOverLimit}
          >
            {t('interview.send')}
          </Button>
        )}
        {onSkip && !isStreaming && (
          <Button
            type="text"
            icon={<ForwardOutlined />}
            onClick={onSkip}
            disabled={disabled}
          >
            {t('interview.skip')}
          </Button>
        )}
      </Space>
    </div>
  );
};

export default InterviewInput;
