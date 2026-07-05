export default function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 104" className={className} role="img" aria-hidden="true">
      <circle cx="52" cy="52" r="46" fill="#e2725b" />
      <circle cx="150" cy="52" r="46" fill="#eba15a" />
      <circle cx="248" cy="52" r="46" fill="#7fb9a2" />

      {/* runner */}
      <g fill="#1a1a1a">
        <circle cx="54" cy="26" r="8" />
        <path
          d="M58 36
             q6 2 10 8 q3 4 9 3 l1 6 q-9 2 -14 -4 l-3 -3
             l-4 12 l8 12 q2 3 -1 5 q-3 1 -5 -2 l-9 -13 q-2 -3 -1 -6 l3 -9
             l-10 6 l-2 12 q-1 4 -5 3 q-3 -1 -2 -5 l3 -15 q0 -3 3 -5 l16 -10 q3 -2 6 0 z"
        />
      </g>

      {/* cyclist */}
      <g fill="none" stroke="#1a1a1a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="130" cy="72" r="15" />
        <circle cx="172" cy="72" r="15" />
        <path d="M130 72 L150 72 L138 48 L162 48" />
        <path d="M150 72 L162 48" />
        <path d="M130 72 L142 50" />
      </g>
      <g fill="#1a1a1a">
        <circle cx="150" cy="26" r="8" />
        <path d="M150 34 q7 1 9 8 l4 12 q1 4 -3 5 q-4 1 -5 -3 l-4 -12 q-3 -8 -1 -10 z" />
      </g>
      <g fill="none" stroke="#1a1a1a" strokeWidth="6" strokeLinecap="round">
        <path d="M156 40 L142 50" />
        <path d="M158 47 L162 48" />
      </g>

      {/* swimmer */}
      <g fill="#1a1a1a">
        <circle cx="228" cy="42" r="8" />
        <path
          d="M234 46
             q10 -1 18 -7 q3 -2 5 1 q2 3 -1 5 q-9 7 -21 7
             q-4 0 -7 -2 l-8 -4 q2 5 -2 8 q-4 2 -12 4 q-4 1 -5 -3 q-1 -3 3 -5 q6 -1 8 -3 q1 -2 -1 -4 l-6 -5 q-3 -3 0 -6 q3 -2 6 0 l14 9 q3 2 7 4 z"
        />
      </g>
      <g fill="none" stroke="#1a1a1a" strokeWidth="6" strokeLinecap="round">
        <path d="M212 74 q9 -6 18 0 t18 0 t18 0" />
      </g>
    </svg>
  );
}
