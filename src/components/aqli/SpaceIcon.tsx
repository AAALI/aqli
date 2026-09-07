import {
  IconArchive,
  IconBook,
  IconChat,
  IconFlag,
  IconFolder,
  IconGear,
  IconTable,
  IconUsers,
} from "./icons";

/**
 * A space's mark (v3 §2).
 *
 * Line icons replace the emoji defaults, but emoji stays *selectable* — so
 * this resolves whichever a space happens to carry and renders both in the
 * same 18×16 slot, which is what keeps a mixed list aligned.
 *
 * Existing workspaces store the old default emoji, so those are mapped to
 * their v3 icon here rather than by a migration: a stored emoji is the user's
 * data, and rewriting it would silently discard a deliberate choice made by
 * anyone who picked 🏢 on purpose.
 */
const ICONS = {
  book: IconBook,
  flag: IconFlag,
  gear: IconGear,
  users: IconUsers,
  table: IconTable,
  chat: IconChat,
  archive: IconArchive,
  folder: IconFolder,
} as const;

export type SpaceIconKey = keyof typeof ICONS;

export const SPACE_ICON_KEYS = Object.keys(ICONS) as SpaceIconKey[];

/** The old emoji defaults, in the pairing frame 03 draws. */
const FROM_EMOJI: Record<string, SpaceIconKey> = {
  "🏢": "book", // Company
  "🧭": "flag", // Product
  "⚙️": "gear", // Engineering
  "⚙": "gear",
  "🤝": "users", // People
  "💼": "table", // Sales
  "📣": "chat", // Marketing
  "🔧": "archive", // Ops
  "📋": "folder", // the custom-space default
};

export function spaceIconKey(icon: string | null | undefined): SpaceIconKey | null {
  if (!icon) return "folder";
  if (icon in ICONS) return icon as SpaceIconKey;
  return FROM_EMOJI[icon] ?? null;
}

export default function SpaceIcon({
  icon,
  size = 16,
}: {
  icon: string | null | undefined;
  size?: number;
}) {
  const key = spaceIconKey(icon);
  // No key means the space carries an emoji somebody chose. Render it as-is.
  if (!key) return <>{icon}</>;
  const Glyph = ICONS[key];
  return <Glyph size={size} />;
}
