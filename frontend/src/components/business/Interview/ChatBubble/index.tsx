import React from 'react';
import { Typography } from 'antd';
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
  return (
    <div className={`chat-bubble ${isUser ? 'chat-bubble--user' : 'chat-bubble--ai'} ${safetyFlag ? 'chat-bubble--safety' : ''}`}>
      {!isUser && (
        <div className="chat-bubble__avatar">
          <span role="img" aria-label="assistant">🤖</span>
        </div>
      )}
      <div className="chat-bubble__content">
        <div className="chat-bubble__text">
          <Text>{content}</Text>
          {isStreaming && <span className="chat-bubble__cursor">|</span>}
        </div>
        {timestamp && (
          <Text type="secondary" className="chat-bubble__time">
            {new Date(timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
      </div>
    </div>
  );
};

export default ChatBubble;
