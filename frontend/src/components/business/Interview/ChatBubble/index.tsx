import React from 'react';
import { Typography } from 'antd';
import { motion } from 'framer-motion';
import MediatorAvatar from '@/components/business/MediatorAvatar';
import { getLocale } from '@/utils/i18n';
import './index.less';

const { Text } = Typography;

interface ChatBubbleProps {
  content: string;
  isUser: boolean;
  isStreaming?: boolean;
  timestamp?: string;
  safetyFlag?: boolean;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ content, isUser, isStreaming, timestamp, safetyFlag }) => {
  const locale = getLocale();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`chat-bubble ${isUser ? 'chat-bubble--user' : 'chat-bubble--ai'} ${safetyFlag ? 'chat-bubble--safety' : ''}`}
    >
      {!isUser && (
        <div className="chat-bubble__avatar">
          <MediatorAvatar size="small" />
        </div>
      )}
      <div className="chat-bubble__content">
        <div className="chat-bubble__text">
          <Text>{content}</Text>
          {isStreaming && <span className="chat-bubble__cursor">|</span>}
        </div>
        {timestamp && (
          <Text type="secondary" className="chat-bubble__time">
            {new Date(timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </div>
    </motion.div>
  );
};

export default ChatBubble;
