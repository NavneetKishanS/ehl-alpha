import { useId } from "react";

// BMW roundel drawn as inline SVG so it stays crisp at any size and needs no asset.
export function BmwLogo({ size = 40, className }: { size?: number; className?: string }) {
  const arcId = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="BMW">
      <circle cx="50" cy="50" r="49" fill="#111" />
      <circle cx="50" cy="50" r="47" fill="none" stroke="#bfbfbf" strokeWidth="1.2" />
      <path id={arcId} d="M 17 50 A 33 33 0 0 1 83 50" fill="none" />
      <text fill="#fff" fontSize="17" fontWeight="700" letterSpacing="2" fontFamily="Helvetica, Arial, sans-serif">
        <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
          BMW
        </textPath>
      </text>
      <circle cx="50" cy="50" r="27.5" fill="#fff" />
      <path d="M50 50 L50 22.5 A27.5 27.5 0 0 1 77.5 50 Z" fill="#1c69d4" />
      <path d="M50 50 L50 77.5 A27.5 27.5 0 0 1 22.5 50 Z" fill="#1c69d4" />
      <circle cx="50" cy="50" r="27.5" fill="none" stroke="#bfbfbf" strokeWidth="1" />
    </svg>
  );
}
