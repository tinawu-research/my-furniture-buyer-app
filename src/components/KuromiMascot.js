// An original pink/black "punk mascot" — not a reproduction of any
// copyrighted character's design (deliberately different silhouette,
// face, and features) — used to give the theme a recurring visual anchor.
export default function KuromiMascot({ size = 64, className = "" }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <ellipse cx="28" cy="26" rx="14" ry="18" fill="#1a1420" transform="rotate(-15 28 26)" />
      <ellipse cx="72" cy="26" rx="14" ry="18" fill="#1a1420" transform="rotate(15 72 26)" />
      <ellipse cx="28" cy="28" rx="6.5" ry="10" fill="#ff8fc4" transform="rotate(-15 28 28)" />
      <ellipse cx="72" cy="28" rx="6.5" ry="10" fill="#ff8fc4" transform="rotate(15 72 28)" />

      <ellipse cx="50" cy="56" rx="34" ry="30" fill="#1a1420" />

      <ellipse cx="27" cy="62" rx="6" ry="4" fill="#ff8fc4" opacity="0.85" />
      <ellipse cx="73" cy="62" rx="6" ry="4" fill="#ff8fc4" opacity="0.85" />

      <path
        d="M50 36c-2.5-4-9-2.5-9 1.5 0 4 9 8 9 8s9-4 9-8c0-4-6.5-5.5-9-1.5z"
        fill="#ff8fc4"
      />

      <ellipse cx="38" cy="53" rx="6" ry="7" fill="#fff" />
      <ellipse cx="62" cy="53" rx="6" ry="7" fill="#fff" />
      <circle cx="39.5" cy="55" r="3" fill="#1a1420" />
      <circle cx="63.5" cy="55" r="3" fill="#1a1420" />
      <circle cx="41.5" cy="52" r="1.1" fill="#fff" />
      <circle cx="65.5" cy="52" r="1.1" fill="#fff" />

      <path
        d="M44 69q6 6 12 0"
        stroke="#ff8fc4"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M56 69.5l2.2 4.5 3-3.3z" fill="#fff" />

      <g>
        <path d="M78 41L93 33.5V48.5Z" fill="#ff8fc4" stroke="#1a1420" strokeWidth="2" />
        <path d="M78 41L63 33.5V48.5Z" fill="#ff8fc4" stroke="#1a1420" strokeWidth="2" />
        <circle cx="78" cy="41" r="4.5" fill="#1a1420" />
      </g>
    </svg>
  );
}
