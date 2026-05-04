/**
 * 判決書查看器組件（遷移：Ant Card/Collapse/Button/Tooltip/Typography/Icons → shadcn + Tailwind + Lucide）
 */

import { Volume2, Share2, Star, Printer, Copy, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { copyToClipboard } from '@/utils/helpers';
import { t, getLocale } from '@/utils/i18n';

interface JudgmentViewerProps {
  content: string;
  title?: string;
  onShare?: () => void;
  onFavorite?: () => void;
  showActions?: boolean;
}

const parseMarkdownSections = (content: string, defaultTitle: string) => {
  const lines = content.split('\n');
  const sections: { title: string; content: string }[] = [];
  let currentTitle = defaultTitle;
  let currentContent: string[] = [];

  lines.forEach(line => {
    if (line.startsWith('## ') || line.startsWith('### ')) {
      if (currentContent.length > 0) {
        sections.push({ title: currentTitle, content: currentContent.join('\n') });
      }
      currentTitle = line.replace(/^#+\s/, '');
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  });

  if (currentContent.length > 0) {
    sections.push({ title: currentTitle, content: currentContent.join('\n') });
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
    [content],
  );

  const handleCopy = async () => {
    const success = await copyToClipboard(content);
    if (success) toast.success(t('common.copied'));
    else toast.error(t('common.copyFail'));
  };

  const handleVoicePlay = () => {
    if ('speechSynthesis' in window) {
      if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
      } else {
        const utterance = new SpeechSynthesisUtterance(content);
        utterance.lang = getLocale().startsWith('zh') ? 'zh-TW' : 'en-US';
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => { setIsPlaying(false); toast.error(t('message.voicePlayFail')); };
        window.speechSynthesis.speak(utterance);
        setIsPlaying(true);
      }
    } else {
      toast.warning(t('message.voiceNotSupported'));
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground font-heading">{title}</h3>
        {showActions && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={handleVoicePlay} aria-label={isPlaying ? t('judgmentViewer.playing') : t('judgmentViewer.play')}>
              <Volume2 className={`size-4 ${isPlaying ? 'text-primary animate-pulse' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={handleCopy} aria-label={t('judgmentViewer.copy')}>
              <Copy className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onShare} aria-label={t('judgmentViewer.share')}>
              <Share2 className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onFavorite} aria-label={t('judgmentViewer.favorite')}>
              <Star className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => window.print()} aria-label={t('judgmentViewer.print')}>
              <Printer className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Content Accordion */}
      <Accordion type="multiple" defaultValue={['0']} className="space-y-2">
        {sections.map((section, index) => (
          <AccordionItem key={index} value={String(index)} className="rounded-lg border border-border px-4">
            <AccordionTrigger className="py-3">
              <span className="text-base font-semibold text-foreground">{section.title}</span>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="text-sm leading-relaxed text-muted-foreground mb-3">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                  li: ({ children }) => <li className="text-sm text-muted-foreground">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary/30 pl-4 py-1 my-3 bg-primary-light/20 rounded-r-lg text-sm italic">{children}</blockquote>
                  ),
                }}
              >
                {section.content}
              </ReactMarkdown>

              {/* AI Insight Tag */}
              <div className="mt-4 flex items-start gap-3 rounded-lg bg-primary-light/30 border border-primary/10 p-3">
                <Bot className="size-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground mb-0.5">{t('judgmentViewer.aiInsightTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('judgmentViewer.aiInsightDesc', { sectionTitle: section.title })}</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default JudgmentViewer;
