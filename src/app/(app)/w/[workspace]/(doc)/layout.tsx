/**
 * The document shell: no sidebar (v3 frames 05, 06, 16).
 *
 * Write and read are the same sheet of paper, and paper does not sit next to a
 * navigation rail. The way back is the breadcrumb in the top bar — one link to
 * the space, which is where a reader came from anyway.
 *
 * A route group, so the URLs are unchanged: `/w/:ws/docs/:id` still resolves
 * here, it simply no longer inherits `(main)`'s sidebar.
 */
export default function DocShell({ children }: { children: React.ReactNode }) {
  return <div className="main">{children}</div>;
}
