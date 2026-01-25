/**
 * 判決書查看器組件（增強版Markdown渲染）
 */

import { Card, Typography, Button, Space, Tooltip } from 'antd';
import {
  SoundOutlined,
  ShareAltOutlined,
  StarOutlined,
  PrinterOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';
import { copyToClipboard } from '@/utils/helpers';
import { message } from 'antd';
import './JudgmentViewer.less';

const { Title } = Typography;

interface JudgmentViewerProps {
  content: string;
  title?: string;
  onShare?: () => void;
  onFavorite?: () => void;
  showActions?: boolean;
}

const JudgmentViewer = ({
  content,
  title = '判決書',
  onShare,
  onFavorite,
  showActions = true,
}: JudgmentViewerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(content);
    if (success) {
      message.success('已複製到剪貼板');
    } else {
      message.error('複製失敗');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleVoicePlay = () => {
    if ('speechSynthesis' in window) {
      if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
      } else {
        const utterance = new SpeechSynthesisUtterance(content);
        utterance.lang = 'zh-CN';
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => {
          setIsPlaying(false);
          message.error('語音播放失敗');
        };

        window.speechSynthesis.speak(utterance);
        setIsPlaying(true);
      }
    } else {
      message.warning('您的瀏覽器不支持語音播放');
    }
  };

  return (
    <Card className="judgment-viewer" title={title}>
      {showActions && (
        <div className="judgment-actions">
          <Space>
            <Tooltip title="語音播放">
              <Button
                type="text"
                icon={<SoundOutlined />}
                onClick={handleVoicePlay}
                className={isPlaying ? 'playing' : ''}
              >
                {isPlaying ? '停止' : '播放'}
              </Button>
            </Tooltip>
            <Tooltip title="複製內容">
              <Button type="text" icon={<CopyOutlined />} onClick={handleCopy} />
            </Tooltip>
            <Tooltip title="分享">
              <Button type="text" icon={<ShareAltOutlined />} onClick={onShare} />
            </Tooltip>
            <Tooltip title="收藏">
              <Button type="text" icon={<StarOutlined />} onClick={onFavorite} />
            </Tooltip>
            <Tooltip title="打印">
              <Button type="text" icon={<PrinterOutlined />} onClick={handlePrint} />
            </Tooltip>
          </Space>
        </div>
      )}

      <div className="judgment-content">
        <ReactMarkdown
          components={{
            h1: ({ children }) => <Title level={1}>{children}</Title>,
            h2: ({ children }) => <Title level={2}>{children}</Title>,
            h3: ({ children }) => <Title level={3}>{children}</Title>,
            h4: ({ children }) => <Title level={4}>{children}</Title>,
            p: ({ children }) => <p className="judgment-paragraph">{children}</p>,
            ul: ({ children }) => <ul className="judgment-list">{children}</ul>,
            ol: ({ children }) => <ol className="judgment-list">{children}</ol>,
            li: ({ children }) => <li className="judgment-list-item">{children}</li>,
            strong: ({ children }) => <strong className="judgment-strong">{children}</strong>,
            blockquote: ({ children }) => (
              <blockquote className="judgment-blockquote">{children}</blockquote>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </Card>
  );
};

export default JudgmentViewer;

