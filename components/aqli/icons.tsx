import type { ReactNode, CSSProperties } from "react";

type IcProps = {
  size?: number;
  sw?: number;
  fill?: string;
  style?: CSSProperties;
  className?: string;
};

function Ic({
  d,
  size = 16,
  sw = 1.6,
  fill = "none",
  style,
  className,
}: IcProps & { d: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
    >
      {d}
    </svg>
  );
}

export const IconHome = (p: IcProps) => (
  <Ic {...p} d={<><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10.5V20h14v-9.5" /><path d="M10 20v-5h4v5" /></>} />
);
export const IconSearch = (p: IcProps) => (
  <Ic {...p} d={<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.5-3.5" /></>} />
);
export const IconBell = (p: IcProps) => (
  <Ic {...p} d={<><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 19a2 2 0 0 0 4 0" /></>} />
);
export const IconPlus = (p: IcProps) => (
  <Ic {...p} d={<><path d="M12 5v14M5 12h14" /></>} sw={p.sw ?? 1.8} />
);
export const IconGear = (p: IcProps) => (
  <Ic {...p} d={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>} />
);
export const IconShare = (p: IcProps) => (
  <Ic {...p} d={<><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.7 7.6-4.4M8.2 13.3l7.6 4.4" /></>} />
);
export const IconLink = (p: IcProps) => (
  <Ic {...p} d={<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 7" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1.5-1.5" /></>} />
);
export const IconChevDown = (p: IcProps) => <Ic {...p} d={<path d="m6 9 6 6 6-6" />} />;
export const IconChevRight = (p: IcProps) => <Ic {...p} d={<path d="m9 6 6 6-6 6" />} />;
export const IconChevLeft = (p: IcProps) => <Ic {...p} d={<path d="m15 6-6 6 6 6" />} />;
export const IconDots = (p: IcProps) => (
  <Ic {...p} d={<><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></>} />
);
export const IconSparkle = (p: IcProps) => (
  <Ic {...p} d={<><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></>} sw={p.sw ?? 1.4} />
);
export const IconRobot = (p: IcProps) => (
  <Ic {...p} d={<><rect x="4" y="8" width="16" height="11" rx="2.5" /><path d="M12 4v4" /><circle cx="12" cy="3.5" r="1" fill="currentColor" /><circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none" /><path d="M9.5 16h5" /><path d="M2 13v2M22 13v2" /></>} />
);
export const IconCheck = (p: IcProps) => <Ic {...p} d={<path d="m5 12 5 5 9-11" />} sw={p.sw ?? 2} />;
export const IconX = (p: IcProps) => <Ic {...p} d={<path d="M6 6 18 18M18 6 6 18" />} sw={p.sw ?? 1.8} />;
export const IconArrowUpRight = (p: IcProps) => (
  <Ic {...p} d={<><path d="M7 17 17 7" /><path d="M9 7h8v8" /></>} sw={p.sw ?? 1.7} />
);
export const IconBook = (p: IcProps) => (
  <Ic {...p} d={<><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5V4.5Z" /><path d="M4 17.5A1.5 1.5 0 0 1 5.5 16H20" /></>} />
);
export const IconKey = (p: IcProps) => (
  <Ic {...p} d={<><circle cx="8" cy="14" r="4" /><path d="m11 11 9-9" /><path d="m17 5 2 2" /><path d="m14 8 2 2" /></>} />
);
export const IconFile = (p: IcProps) => (
  <Ic {...p} d={<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 16h6M9 10h3" /></>} />
);
export const IconFolder = (p: IcProps) => (
  <Ic {...p} d={<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />} />
);
export const IconClock = (p: IcProps) => (
  <Ic {...p} d={<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>} />
);
export const IconEdit = (p: IcProps) => (
  <Ic {...p} d={<><path d="M4 20h4l10-10-4-4L4 16v4Z" /><path d="m14 6 4 4" /></>} />
);
export const IconHistory = (p: IcProps) => (
  <Ic {...p} d={<><path d="M3.5 9A8.5 8.5 0 1 1 4 14.5" /><path d="M3.5 5v4h4" /><path d="M12 8v4l3 2" /></>} />
);
export const IconUsers = (p: IcProps) => (
  <Ic {...p} d={<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" /><path d="M17.5 19a5.5 5.5 0 0 0-3-4.9" /></>} />
);
export const IconArchive = (p: IcProps) => (
  <Ic {...p} d={<><rect x="3.5" y="5" width="17" height="4" rx="1" /><path d="M5 9v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" /><path d="M10 13h4" /></>} />
);
export const IconTrash = (p: IcProps) => (
  <Ic {...p} d={<><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></>} />
);
export const IconLock = (p: IcProps) => (
  <Ic {...p} d={<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>} />
);
export const IconHash = (p: IcProps) => (
  <Ic {...p} d={<><path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" /></>} />
);
export const IconMail = (p: IcProps) => (
  <Ic {...p} d={<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>} />
);
export const IconEye = (p: IcProps) => (
  <Ic {...p} d={<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>} />
);
export const IconWarn = (p: IcProps) => (
  <Ic {...p} d={<><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v5M12 17.5v.2" /></>} />
);
export const IconReply = (p: IcProps) => (
  <Ic {...p} d={<><path d="m9 9-5 5 5 5" /><path d="M4 14h11a5 5 0 0 0 0-10h-2" /></>} />
);
export const IconChat = (p: IcProps) => (
  <Ic {...p} d={<path d="M21 12a8 8 0 0 1-8 8H6l-3 2v-10a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />} />
);
export const IconAt = (p: IcProps) => (
  <Ic {...p} d={<><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /></>} />
);
export const IconFlag = (p: IcProps) => (
  <Ic {...p} d={<path d="M5 21V4l13 1.5L14 11l4 5.5L5 18" />} />
);
export const IconWand = (p: IcProps) => (
  <Ic {...p} d={<><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z" /><path d="m14 7 3 3" /><path d="M5 6v4M19 14v4M10 2v2M7 8H3M21 16h-4M11 3H9" /></>} />
);
export const IconQuote = (p: IcProps) => (
  <Ic {...p} d={<><path d="M10 11H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6a4 4 0 0 1-4 4" /><path d="M20 11h-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6a4 4 0 0 1-4 4" /></>} />
);
export const IconCheckCircle = (p: IcProps) => (
  <Ic {...p} d={<><circle cx="12" cy="12" r="9" /><path d="m8.5 12.2 2.4 2.4 4.6-5.2" /></>} />
);
export const IconSlack = (p: IcProps) => (
  <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="currentColor" style={p.style}>
    <path d="M5.04 15.12a2.52 2.52 0 1 1-2.52-2.52h2.52v2.52Zm1.26 0a2.52 2.52 0 0 1 5.04 0v6.3a2.52 2.52 0 1 1-5.04 0v-6.3Zm2.52-10.08A2.52 2.52 0 1 1 11.34 2.52v2.52H8.82Zm0 1.26a2.52 2.52 0 0 1 0 5.04h-6.3a2.52 2.52 0 1 1 0-5.04h6.3Zm10.14 2.52a2.52 2.52 0 1 1 2.52 2.52h-2.52V8.82Zm-1.26 0a2.52 2.52 0 0 1-5.04 0v-6.3a2.52 2.52 0 1 1 5.04 0v6.3Zm-2.52 10.08a2.52 2.52 0 1 1-2.52 2.52v-2.52h2.52Zm0-1.26a2.52 2.52 0 0 1 0-5.04h6.3a2.52 2.52 0 1 1 0 5.04h-6.3Z" />
  </svg>
);
export const IconLinear = (p: IcProps) => (
  <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="currentColor" style={p.style}>
    <path d="M2.2 13.6a10 10 0 0 0 8.2 8.2L2.2 13.6Zm-.2-2.3 11 11a10 10 0 0 0 2.4-.4L2.4 8.9a10 10 0 0 0-.4 2.4Zm1.1-4.2L17 20.9a10 10 0 0 0 2-1.2L4.3 5.1a10 10 0 0 0-1.2 2Zm2.4-3L20 19.6a10.1 10.1 0 0 0 1.5-1.8L6.2 2.6A10.1 10.1 0 0 0 4.5 4.1ZM8.4 1.3 22.7 15.6A10 10 0 0 0 8.4 1.3Z" />
  </svg>
);
export const IconGitHub = (p: IcProps) => (
  <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="currentColor" style={p.style}>
    <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.3v3.4c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
  </svg>
);
export const IconLogOut = (p: IcProps) => (
  <Ic {...p} d={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>} />
);
