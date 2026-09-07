/**
 * Doc images — the rules shared by the upload route, the read route and the
 * editor. Kept free of server-only imports so the client can enforce the same
 * limits before it spends a round trip on a file the server will reject.
 *
 * The URL written into `body_md` is `/api/images/<object path>`, not a Storage
 * URL. That is the whole design: `body_md` is canonical, so a link inside it
 * has to outlive any token. A signed Storage URL expires and would rot in
 * place; a public bucket would make every screenshot world-readable to anyone
 * who learned the path. An app route keeps the link stable *and* re-checks
 * workspace membership on every request.
 */

export const DOC_IMAGE_BUCKET = "doc-images";

/** Matches `file_size_limit` on the bucket. Both need changing together. */
export const DOC_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Content types the bucket admits, and the extension each is stored under.
 *
 * No SVG: it can carry script, and these files are served from the app's own
 * origin. The bucket's `allowed_mime_types` enforces the same list server-side.
 */
export const DOC_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export function isDocImageMime(type: string): boolean {
  return type in DOC_IMAGE_EXTENSIONS;
}

/** The URL that goes into the markdown. */
export function docImageUrl(objectPath: string): string {
  return `/api/images/${objectPath}`;
}

/**
 * Storage object path for a new upload: `<workspace>/<doc>/<random>.<ext>`.
 *
 * The first two segments are what the Storage RLS policies read to decide
 * access, so they are not cosmetic. The basename is random rather than the
 * user's filename — a filename is attacker-influenced text that would end up in
 * a URL, and two people pasting `Screenshot.png` must not collide.
 */
export function docImageObjectPath(
  workspaceId: string,
  docId: string,
  mime: string,
): string {
  const ext = DOC_IMAGE_EXTENSIONS[mime] ?? "bin";
  return `${workspaceId}/${docId}/${crypto.randomUUID()}.${ext}`;
}

/** Human-readable reason a file is not uploadable, or null if it is. */
export function docImageRejection(file: {
  type: string;
  size: number;
}): string | null {
  if (!isDocImageMime(file.type)) {
    return "That file type isn't supported. Use PNG, JPEG, GIF or WebP.";
  }
  if (file.size > DOC_IMAGE_MAX_BYTES) {
    return `Images must be under ${Math.round(DOC_IMAGE_MAX_BYTES / (1024 * 1024))} MB.`;
  }
  return null;
}
