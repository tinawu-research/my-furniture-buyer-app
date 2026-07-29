// Small decorative motif icons for the pink/black theme — hearts, a crown,
// and chess-piece silhouettes, echoing the reference mood board without
// reproducing any copyrighted character art.

export function Heart({ size = 24, color = "#1a1420", className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path
        d="M12 21s-7.5-4.6-10-9.3C.4 8 2 4.5 5.5 3.7 8 3.1 10.3 4.4 12 7c1.7-2.6 4-3.9 6.5-3.3C22 4.5 23.6 8 22 11.7 19.5 16.4 12 21 12 21z"
        fill={color}
      />
    </svg>
  );
}

export function Crown({ size = 24, color = "#1a1420", className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path
        d="M3 8l4 3 5-6 5 6 4-3-1.5 10h-15L3 8z"
        fill={color}
      />
      <circle cx="3" cy="6.5" r="1.6" fill={color} />
      <circle cx="12" cy="4" r="1.6" fill={color} />
      <circle cx="21" cy="6.5" r="1.6" fill={color} />
    </svg>
  );
}

export function ChessPawn({ size = 24, color = "#1a1420", className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="12" cy="6" r="3" fill={color} />
      <path d="M9 11h6l1.5 3H7.5z" fill={color} />
      <path d="M7 16h10l1 4H6z" fill={color} />
      <rect x="5" y="20" width="14" height="2" rx="1" fill={color} />
    </svg>
  );
}

export function ChessKnight({ size = 24, color = "#1a1420", className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path
        d="M7 21l1-6c-2-1-3-3-2.5-6C6 5 9 3 12 3c2 0 3 1 4 2l-2 2c1 1 2 3 1 5l3 1-1 3-3-.5-1 5.5z"
        fill={color}
      />
      <circle cx="10" cy="7" r="0.9" fill="#ff8fc4" />
      <rect x="6" y="21" width="12" height="2" rx="1" fill={color} />
    </svg>
  );
}
