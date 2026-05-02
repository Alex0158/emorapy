import React, { useState, useRef } from 'react';
import { Input, Button, Space, Typography, Tag } from 'antd';
import { SendOutlined, StopOutlined, ForwardOutlined, CoffeeOutlined } from '@ant-design/icons';
import { t } from '@/utils/i18n';
import './index.less';

const { TextArea } = Input;
const { Text } = Typography;

const MAX_CHARS = 2000;

const QUICK_TAGS = [
  { labelKey: 'interview.quickTag.needCalmDown', icon: <CoffeeOutlined /> },
  { labelKey: 'interview.quickTag.imAngry', icon: '😠' },
  { labelKey: 'interview.quickTag.notReadyToTalk', icon: '🛑' },
  { labelKey: 'interview.quickTag.iAgree', icon: '👍' },
];

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

  const handleQuickTag = (tagLabel: string) => {
    if (disabled || isStreaming) return;
    onSend(tagLabel);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="interview-input-wrapper">
      {!isStreaming && !disabled && (
        <div className="interview-input-wrapper__quick-tags scrollbar-hide">
          {QUICK_TAGS.map((tag, idx) => (
            <Tag 
              key={idx} 
              className="quick-tag cursor-pointer px-3 py-1.5 rounded-full border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors text-sm flex items-center gap-1"
              onClick={() => handleQuickTag(t(tag.labelKey))}
            >
              <span>{tag.icon}</span> {t(tag.labelKey)}
            </Tag>
          ))}
        </div>
      )}
      
      <div className="interview-input">
        <div className="interview-input__area">
          <TextArea
            ref={inputRef as unknown as React.RefObject<import('antd/es/input/TextArea').TextAreaRef>}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? t('interview.sendPlaceholder')}
            disabled={disabled || isStreaming}
            autoSize={{ minRows: 1, maxRows: 4 }}
            className="interview-input__textarea"
            status={isOverLimit ? 'error' : undefined}
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
        <Space className="input-actions">
          {isStreaming && onStop ? (
            <Button
              type="primary"
              shape="circle"
              icon={<StopOutlined />}
              onClick={onStop}
              danger
              aria-label={t('interview.stop')}
              className="action-btn stop-btn"
            />
          ) : (
            <Button
              type="primary"
              shape="circle"
              icon={<SendOutlined />}
              onClick={handleSend}
              disabled={!value.trim() || disabled || isOverLimit}
              aria-label={t('interview.send')}
              className="action-btn send-btn"
            />
          )}
          {onSkip && !isStreaming && (
            <Button
              type="text"
              shape="circle"
              icon={<ForwardOutlined />}
              onClick={onSkip}
              disabled={disabled}
              aria-label={t('interview.skip')}
              className="action-btn skip-btn"
            />
          )}
        </Space>
      </div>
    </div>
  );
};

export default InterviewInput;
