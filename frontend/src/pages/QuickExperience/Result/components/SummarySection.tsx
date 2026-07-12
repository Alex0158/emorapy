import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { t } from '@/utils/i18n';

type Props = { summary?: string | null };

const SummarySection = ({ summary }: Props) => {
  return (
    <section className="mb-6" aria-labelledby="summary-title">
      <Accordion type="single" defaultValue="summary" collapsible>
        <AccordionItem value="summary" className="border-y border-border px-1">
          <AccordionTrigger className="py-3">
            <span id="summary-title" className="text-base font-semibold">{t('summary.title')}</span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            {summary && (
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground" role="article">{summary}</p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
};

export default SummarySection;
