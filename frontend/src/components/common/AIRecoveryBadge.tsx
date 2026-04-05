interface AIRecoveryBadgeProps {
  text: string;
  className?: string;
}

export default function AIRecoveryBadge({
  text,
  className,
}: AIRecoveryBadgeProps) {
  return (
    <span
      className={className}
      data-ai-recovery-badge="true"
      role="status"
      aria-live="polite"
    >
      {text}
    </span>
  );
}
