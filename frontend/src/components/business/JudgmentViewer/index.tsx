import { Volume2, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/utils/helpers';
import { t, getLocale } from '@/utils/i18n';

interface JudgmentViewerProps {
  content: string;
  title?: string;
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
    <article className="border-y border-border bg-card py-6 md:py-8">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight text-foreground font-heading">{title}</h3>
        {showActions && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleVoicePlay} aria-label={isPlaying ? t('judgmentViewer.playing') : t('judgmentViewer.play')}>
              <Volume2 className={isPlaying ? 'size-4 text-primary' : 'size-4'} />
              {isPlaying ? t('judgmentViewer.playing') : t('judgmentViewer.play')}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCopy} aria-label={t('judgmentViewer.copy')}>
              <Copy className="size-4" />
              {t('judgmentViewer.copy')}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-8">
        {sections.map((section, index) => (
          <section key={`${section.title}-${index}`} className="space-y-3">
            <h4 className="text-base font-semibold text-foreground">{section.title}</h4>
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-3 text-[15px] leading-7 text-muted-foreground">{children}</p>,
                ul: ({ children }) => <ul className="mb-3 list-disc space-y-2 pl-5">{children}</ul>,
                ol: ({ children }) => <ol className="mb-3 list-decimal space-y-2 pl-5">{children}</ol>,
                li: ({ children }) => <li className="text-[15px] leading-7 text-muted-foreground">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                blockquote: ({ children }) => (
                  <blockquote className="my-4 border-l-2 border-primary/60 pl-4 text-[15px] leading-7 text-foreground">{children}</blockquote>
                ),
              }}
            >
              {section.content}
            </ReactMarkdown>
          </section>
        ))}
      </div>
    </article>
  );
};

export default JudgmentViewer;
