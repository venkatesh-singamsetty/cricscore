interface HighlightedResultProps {
  text: string;
  teamClassName?: string;
}

export default function HighlightedResult({
  text,
  teamClassName = "text-emerald-400",
}: HighlightedResultProps) {
  const idx = text.indexOf(" WON BY ");
  if (idx <= 0) return <>{text}</>;
  return (
    <>
      <span className={teamClassName}>{text.slice(0, idx)}</span>
      {text.slice(idx)}
    </>
  );
}
