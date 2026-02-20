export default function Seal() {
  return (
    <svg
      aria-label="The Country Factbook seal"
      role="img"
      viewBox="0 0 320 320"
      className="seal"
    >
      <circle cx="160" cy="160" r="154" fill="none" stroke="currentColor" strokeWidth="4" />
      <circle cx="160" cy="160" r="132" fill="none" stroke="currentColor" strokeWidth="2" />

      <g fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.85">
        <circle cx="160" cy="160" r="56" />
        <ellipse cx="160" cy="160" rx="56" ry="24" />
        <ellipse cx="160" cy="160" rx="56" ry="40" />
        <ellipse cx="160" cy="160" rx="24" ry="56" />
        <ellipse cx="160" cy="160" rx="40" ry="56" />
        <path d="M104 160h112" />
      </g>

      <defs>
        <path id="topArc" d="M 42 160 A 118 118 0 0 1 278 160" />
        <path id="bottomArc" d="M 278 160 A 118 118 0 0 1 42 160" />
      </defs>
      <text fill="currentColor" fontSize="16" letterSpacing="2.2" fontWeight="600">
        <textPath href="#topArc" startOffset="50%" textAnchor="middle">
          THE COUNTRY FACTBOOK
        </textPath>
      </text>
      <text fill="currentColor" fontSize="14" letterSpacing="1.8" fontWeight="600">
        <textPath href="#bottomArc" startOffset="50%" textAnchor="middle">
          REFERENCE EDITION 2026
        </textPath>
      </text>
    </svg>
  );
}
