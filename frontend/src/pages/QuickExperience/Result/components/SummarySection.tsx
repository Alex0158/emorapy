import { HelpCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { t } from '@/utils/i18n';

type Props = { summary?: string | null };

const SummarySection = ({ summary }: Props) => {
  return (
    <section className="mb-6" aria-labelledby="summary-title">
      <Accordion type="single" defaultValue="summary" collapsible>
        <AccordionItem value="summary" className="rounded-xl border border-border px-4">
          <AccordionTrigger className="py-3">
            <span id="summary-title" className="text-base font-semibold">{t('summary.title')}</span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            {summary && (
              <div className="flex items-start gap-3" role="article">
                <HelpCircle className="size-4 shrink-0 mt-0.5 text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
};

export default SummarySection;
