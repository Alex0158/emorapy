/**
 * 判決書查看器組件（增強版Markdown渲染）
 */

import { Card, Typography, Button, Space, Tooltip, Collapse } from 'antd';
import {
  SoundOutlined,
  ShareAltOutlined,
  StarOutlined,
  PrinterOutlined,
  CopyOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { useState, useMemo } from 'react';
import { copyToClipboard } from '@/utils/helpers';
import { message } from 'antd';
import { t, getLocale } from '@/utils/i18n';
import './JudgmentViewer.less';

const { Title, Text } = Typography;

interface JudgmentViewerProps {
  content: string;
  title?: string;
  onShare?: () => void;
  onFavorite?: () => void;
  showActions?: boolean;
}

// 簡單解析 Markdown，將其按標題拆分為多個區塊
const parseMarkdownSections = (content: string, defaultTitle: string) => {
  const lines = content.split('\n');
  const sections: { title: string; content: string; type: string }[] = [];
  let currentTitle = defaultTitle;
  let currentContent: string[] = [];

  lines.forEach(line => {
    if (line.startsWith('## ') || line.startsWith('### ')) {
      if (currentContent.length > 0) {
        sections.push({ title: currentTitle, content: currentContent.join('\n'), type: 'section' });
      }
      currentTitle = line.replace(/^#+\s/, '');
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  });

  if (currentContent.length > 0) {
    sections.push({ title: currentTitle, content: currentContent.join('\n'), type: 'section' });
  }

  return sections;
};

const JudgmentViewer = ({
  content,
  title = t('judgmentDetail.docTitle'),
  onShare,
  onFavorite,
  showActions = true,
}: JudgmentViewerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const sections = useMemo(
    () => parseMarkdownSections(content, t('judgmentViewer.defaultSectionTitle')),
    [content]
  );

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
        utterance.lang = getLocale().startsWith('zh') ? 'zh-TW' : 'en-US';
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
    <Card className="judgment-viewer glassmorphism-2" title={title}>
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
        <Collapse 
          defaultActiveKey={['0']} 
          ghost 
          expandIconPosition="end"
          className="judgment-accordion"
          items={sections.map((section, index) => ({
            key: String(index),
            label: (
              <div className="flex items-center gap-3">
                <Title level={4} style={{ margin: 0 }}>{section.title}</Title>
              </div>
            ),
            children: (
              <div className="section-body relative">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="judgment-paragraph text-lg leading-relaxed text-gray-700">{children}</p>,
                    ul: ({ children }) => <ul className="judgment-list list-disc pl-6 mb-4">{children}</ul>,
                    ol: ({ children }) => <ol className="judgment-list list-decimal pl-6 mb-4">{children}</ol>,
                    li: ({ children }) => <li className="judgment-list-item mb-2">{children}</li>,
                    strong: ({ children }) => <strong className="judgment-strong font-bold text-gray-900">{children}</strong>,
                    blockquote: ({ children }) => (
                      <blockquote className="judgment-blockquote border-l-4 border-primary pl-4 py-1 my-4 bg-gray-50 rounded-r-lg">{children}</blockquote>
                    ),
                  }}
                >
                  {section.content}
                </ReactMarkdown>
                
                {/* Explainable AI Tag */}
                <div className="ai-insight-tag mt-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-3">
                  <RobotOutlined className="text-blue-500 mt-1" />
                  <div>
                    <Text strong className="text-blue-700 text-sm block mb-1">{t('judgmentViewer.aiInsightTitle')}</Text>
                    <Text className="text-blue-600/80 text-sm">
                      {t('judgmentViewer.aiInsightDesc', { sectionTitle: section.title })}
                    </Text>
                  </div>
                </div>
              </div>
            )
          }))}
        />
      </div>
    </Card>
  );
};

export default JudgmentViewer;

