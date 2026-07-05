export default function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 100" className={className} role="img" aria-hidden="true">
      <circle cx="50" cy="46" r="40" fill="#e2725b" />
      <circle cx="150" cy="46" r="40" fill="#eba15a" />
      <circle cx="250" cy="46" r="40" fill="#7fb9a2" />

      {/* runner */}
      <g stroke="#1a1a1a" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="46" cy="18" r="6" fill="#1a1a1a" stroke="none" />
        <path d="M46 26 L40 42 L54 48 L48 66" />
        <path d="M40 42 L60 36" />
        <path d="M48 66 L38 78" />
        <path d="M48 66 L60 74" />
        <path d="M54 48 L68 44" />
      </g>

      {/* cyclist */}
      <g stroke="#1a1a1a" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="150" cy="18" r="6" fill="#1a1a1a" stroke="none" />
        <path d="M150 26 L146 40 L160 44 L152 54" />
        <circle cx="130" cy="70" r="14" />
        <circle cx="172" cy="70" r="14" />
        <path d="M130 70 L152 54 L172 70" />
        <path d="M152 54 L146 40" />
      </g>

      {/* swimmer */}
      <g stroke="#1a1a1a" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="230" cy="38" r="6" fill="#1a1a1a" stroke="none" />
        <path d="M236 40 L256 34" />
        <path d="M224 42 L210 50" />
        <path d="M224 42 L234 54 L220 62" />
        <path d="M198 64 Q210 58 222 64 T246 64 T270 64" />
      </g>
    </svg>
  );
}
