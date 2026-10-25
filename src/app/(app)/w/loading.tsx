/**
 * Above the workspace layout, which resolves the session and the workspace
 * before anything can render: on a hard load the page is a blank of the right
 * colour at once, instead of the browser's own white, and the shell streams in.
 */
export default function Loading() {
  return <div className="aqli-screen is-app" aria-busy aria-label="Loading" />;
}
