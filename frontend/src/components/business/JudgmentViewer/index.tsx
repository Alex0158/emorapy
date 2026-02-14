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
import { t } from '@/utils/i18n';
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
  title = t('judgmentDetail.docTitle'),
  onShare,
  onFavorite,
  showActions = true,
}: JudgmentViewerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(content);
    if (success) {
      message.success(t('common.copied'));
    } else {
      message.error(t('common.copyFail'));
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
          message.error(t('message.voicePlayFail'));
        };

        window.speechSynthesis.speak(utterance);
        setIsPlaying(true);
      }
    } else {
      message.warning(t('message.voiceNotSupported'));
    }
  };

  return (
    <Card className="judgment-viewer" title={title}>
      {showActions && (
        <div className="judgment-actions">
          <Space>
            <Tooltip title={t('judgmentViewer.voicePlay')}>
              <Button
                type="text"
                icon={<SoundOutlined />}
                onClick={handleVoicePlay}
                className={isPlaying ? 'playing' : ''}
                aria-label={isPlaying ? t('judgmentViewer.playing') : t('judgmentViewer.play')}
              >
                {isPlaying ? t('judgmentViewer.playing') : t('judgmentViewer.play')}
              </Button>
            </Tooltip>
            <Tooltip title={t('judgmentViewer.copy')}>
              <Button type="text" icon={<CopyOutlined />} onClick={handleCopy} aria-label={t('judgmentViewer.copy')} />
            </Tooltip>
            <Tooltip title={t('judgmentViewer.share')}>
              <Button type="text" icon={<ShareAltOutlined />} onClick={onShare} aria-label={t('judgmentViewer.share')} />
            </Tooltip>
            <Tooltip title={t('judgmentViewer.favorite')}>
              <Button type="text" icon={<StarOutlined />} onClick={onFavorite} aria-label={t('judgmentViewer.favorite')} />
            </Tooltip>
            <Tooltip title={t('judgmentViewer.print')}>
              <Button type="text" icon={<PrinterOutlined />} onClick={handlePrint} aria-label={t('judgmentViewer.print')} />
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

