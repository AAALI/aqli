/**
 * What a screen looks like before its data arrives.
 *
 * Rendered by every route group's `loading.tsx`, which is what makes a tap
 * answer at once: Next prefetches the loading boundary of a dynamic route and
 * shows it the moment a link is tapped, while the real page streams in behind
 * it. Without one, a phone on a slow link saw nothing happen for the whole
 * server round trip and the tap felt ignored.
 *
 * Bars, never a spinner, in the place the words will appear (§4).
 */

const bar = (width: string, height = 13): React.CSSProperties => ({
  height,
  width,
  borderRadius: 4,
  background: "var(--bg-sidebar)",
});

/** A list screen: the top bar, a title and a few rows. */
export function ListSkeleton() {
  return (
    <div aria-busy aria-label="Loading" style={{ display: "contents" }}>
      <div className="tb" aria-hidden>
        <div style={bar("90px", 12)} />
      </div>
      <div className="wrap" aria-hidden>
        <div className="wrap-in">
          <div style={bar("46%", 28)} />
          <div style={{ ...bar("62%", 12), marginTop: 14 }} />
          <div style={{ marginTop: 44, display: "flex", flexDirection: "column", gap: 26 }}>
            {[88, 70, 80, 64].map((w, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={bar(`${w}%`, 15)} />
                <div style={bar(`${Math.round(w * 0.55)}%`, 11)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The paper: a bare top bar, a title and three lines, at the real measure. */
export function PaperSkeleton() {
  return (
    <div aria-busy aria-label="Loading" style={{ display: "contents" }}>
      <div className="tb bare" aria-hidden>
        <div style={bar("110px", 12)} />
      </div>
      <div className="main-body" aria-hidden>
        <div className="doc-scroll">
          <div className="doc-col">
            <div style={bar("62%", 40)} />
            <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 14 }}>
              {[100, 96, 74].map((w, i) => (
                <div key={i} style={bar(`${w}%`, 14)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
