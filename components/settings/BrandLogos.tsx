export function LinearLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="lin-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5E6AD2" />
          <stop offset="100%" stopColor="#3B49C3" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#lin-grad)" />
      <path d="M5 19 19 5M5 14 14 5M5 9 9 5M10 19 19 10M15 19 19 15" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

export function SlackLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#3F0F3F" />
      <g transform="translate(5 5)">
        <rect x="0" y="2" width="3" height="6" rx="1.5" fill="#36C5F0" />
        <rect x="2" y="0" width="6" height="3" rx="1.5" fill="#2EB67D" />
        <rect x="6" y="2" width="3" height="6" rx="1.5" fill="#ECB22E" />
        <rect x="2" y="6" width="6" height="3" rx="1.5" fill="#E01E5A" />
      </g>
    </svg>
  );
}

export function GitHubLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#1A1A18" />
      <path d="M12 5a5 5 0 0 0-1.6 9.7c.3.1.4-.1.4-.3v-1c-1.4.3-1.7-.7-1.7-.7-.2-.6-.6-.7-.6-.7-.5-.3 0-.3 0-.3.6 0 .9.6.9.6.5.9 1.3.6 1.6.5 0-.4.2-.6.4-.8-1.1-.1-2.3-.6-2.3-2.5 0-.5.2-1 .5-1.3 0-.2-.2-.7.1-1.4 0 0 .4-.1 1.4.5a4.7 4.7 0 0 1 2.5 0c.9-.6 1.4-.5 1.4-.5.3.7.1 1.2.1 1.4.3.3.5.8.5 1.3 0 1.9-1.2 2.3-2.3 2.5.2.2.4.5.4 1V14.4c0 .2 0 .4.4.3A5 5 0 0 0 12 5Z" fill="#fff" />
    </svg>
  );
}

export function McpLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#0F6E56" />
      <path d="M7 17V8l3 4 3-4v9M14 13h4M14 17h4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function providerLogo(id: string, size = 36) {
  switch (id) {
    case "linear": return <LinearLogo size={size} />;
    case "slack": return <SlackLogo size={size} />;
    case "github": return <GitHubLogo size={size} />;
    default: return <McpLogo size={size} />;
  }
}
