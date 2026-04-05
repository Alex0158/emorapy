interface AIThinkingIndicatorProps {
  text: string;
  className?: string;
  dotsClassName?: string;
}

export default function AIThinkingIndicator({
  text,
  className,
  dotsClassName,
}: AIThinkingIndicatorProps) {
  return (
    <span className={className} data-ai-thinking="true">
      <span>{text}</span>
      <span className={dotsClassName} aria-hidden="true">...</span>
    </span>
  );
}
