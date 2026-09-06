export function AqliMark({
  size = 20,
  color = "var(--accent)",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Aqli">
      <path
        d="M5 14.5C5 9 9 5 13 5c3.5 0 5.8 2.3 5.8 5.2 0 2.6-1.8 4.5-4.3 4.5-1.7 0-2.9-1-2.9-2.5 0-1.4 1-2.4 2.2-2.4.5 0 .9.1 1.2.3"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6.4" cy="17.6" r="1.5" fill={color} />
    </svg>
  );
}

export function AqliWordmark({ size = 20 }: { size?: number }) {
  return (
    <div className="sb-brand">
      <AqliMark size={size} />
      <span className="sb-brand-word">aqli</span>
    </div>
  );
}
