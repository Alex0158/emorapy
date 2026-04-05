interface AIStreamingTextProps {
  text: string;
  cursorClassName: string;
  showCursor?: boolean;
}

export default function AIStreamingText({
  text,
  cursorClassName,
  showCursor = true,
}: AIStreamingTextProps) {
  return (
    <>
      {text}
      {showCursor ? <span className={cursorClassName}>|</span> : null}
    </>
  );
}
