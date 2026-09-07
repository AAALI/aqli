"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { avatarColor, formatRelative } from "@/lib/utils";
import { toSegments } from "@/lib/mentions";
import { IconChat, IconTrash } from "@/components/aqli/icons";
import MentionTextarea, {
  resolveMentions,
  withUniqueLabels,
  type MentionCandidate,
} from "./MentionTextarea";
import { isReviewTrail, type CommentType, type DocCommentView } from "@/types/comment";

/** How each review-trail entry introduces itself. */
const TRAIL_LABEL: Record<Exclude<CommentType, "comment">, string> = {
  review_request: "requested review",
  approval: "approved this doc",
  rejection: "sent this back to draft",
  change_request: "asked for changes",
};

function MentionedBody({
  body,
  names,
  currentUserId,
}: {
  body: string;
  names: Record<string, string>;
  currentUserId: string | null;
}) {
  const segments = useMemo(() => toSegments(body, names), [body, names]);
  return (
    <div
      style={{
        fontSize: 13.5,
        lineHeight: 1.6,
        color: "var(--text-primary)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {segments.map((s, i) =>
        s.type === "text" ? (
          <span key={i}>{s.text}</span>
        ) : (
          <span
            key={i}
            style={{
              // Being named yourself is the thing you scan a thread for, so it
              // is the one mention that gets the accent.
              color: s.userId === currentUserId ? "var(--accent)" : "var(--text-secondary)",
              background:
                s.userId === currentUserId ? "var(--accent-light)" : "var(--bg-base)",
              borderRadius: 4,
              padding: "0 4px",
              fontWeight: 500,
            }}
          >
            @{s.label}
          </span>
        ),
      )}
    </div>
  );
}

/**
 * The comment thread under a doc (roadmap phase 2, item 3).
 *
 * It shows two kinds of row from one table. Ordinary comments are what people
 * type here. The rest — rejections, change requests — are the review trail,
 * written by the review path since the first version of this product and, until
 * now, displayed nowhere: a reviewer would send a doc back to draft with a
 * reason and the author would see it bounce with no explanation attached. They
 * share a thread because to a reader they are the same conversation.
 */
export default function DocComments({
  docId,
  initial,
  names: initialNames,
  threadFailed,
  members,
  membersFailed,
  currentUserId,
  canComment,
  canModerate,
}: {
  docId: string;
  initial: DocCommentView[];
  names: Record<string, string>;
  /**
   * The thread could not be read. Distinct from an empty thread, which is a
   * fact about the doc rather than about the request.
   */
  threadFailed: boolean;
  members: { user_id: string; name: string; email: string }[];
  /** The member list could not be read, so the `@` menu has nothing to offer. */
  membersFailed: boolean;
  currentUserId: string | null;
  /** Viewers read the thread but do not add to it — the insert policy agrees. */
  canComment: boolean;
  /** Admins may remove anyone's comment; everyone may remove their own. */
  canModerate: boolean;
}) {
  const router = useRouter();
  const [comments, setComments] = useState(initial);
  const [names, setNames] = useState(initialNames);
  const [draft, setDraft] = useState("");
  const [chosen, setChosen] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(threadFailed);
  const [retrying, setRetrying] = useState(false);
  /**
   * The comment currently being deleted, if any.
   *
   * Deletion is optimistic and rolls back on failure by restoring the list it
   * captured when it started. Two overlapping deletions each capture a
   * snapshot, so the second one rolling back would resurrect the comment the
   * first one successfully removed. One at a time avoids reasoning about it.
   */
  const [deleting, setDeleting] = useState<string | null>(null);

  const candidates: MentionCandidate[] = useMemo(
    () => withUniqueLabels(members),
    [members],
  );

  const remember = useCallback((c: MentionCandidate) => {
    setChosen((prev) => new Map(prev).set(c.label, c.user_id));
  }, []);

  /**
   * Re-read the thread after a failed load.
   *
   * `router.refresh()` alongside it, because the member list this component
   * cannot fetch on its own is a server prop — refreshing re-runs the page's
   * loaders and repopulates the `@` menu in the same click.
   */
  async function retry() {
    if (retrying) return;
    setRetrying(true);
    setError(null);
    try {
      const res = await fetch(`/api/docs/${docId}/comments`);
      if (!res.ok) throw new Error(String(res.status));
      const payload = (await res.json()) as {
        comments: DocCommentView[];
        names: Record<string, string>;
      };
      setComments(payload.comments);
      setNames(payload.names);
      setLoadFailed(false);
      router.refresh();
    } catch {
      setError("Still could not load the comments.");
    } finally {
      setRetrying(false);
    }
  }

  async function post() {
    const text = draft.trim();
    // A post landing mid-deletion would be dropped by that deletion's rollback.
    if (!text || busy || deleting) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/docs/${docId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: resolveMentions(text, chosen) }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        comment?: DocCommentView;
        error?: string;
      };
      if (!res.ok || !payload.comment) {
        setError(payload.error ?? "Could not post that comment.");
        return;
      }
      setComments((prev) => [...prev, payload.comment!]);
      // A mention of someone this thread has not seen yet needs their name in
      // the directory, or it renders with the label frozen into the body.
      setNames((prev) => {
        const next = { ...prev };
        for (const [label, id] of chosen) if (!next[id]) next[id] = label;
        return next;
      });
      setDraft("");
      setChosen(new Map());
      // The comment also lands in the activity trail, which is server-rendered.
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (deleting) return;
    const previous = comments;
    setDeleting(id);
    setError(null);
    setComments((prev) => prev.filter((c) => c.id !== id));
    try {
      const res = await fetch(`/api/docs/${docId}/comments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setComments(previous);
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "Could not delete that comment.");
        return;
      }
      // The activity trail is server-rendered and still lists the comment.
      router.refresh();
    } catch {
      // A network failure leaves the row deleted on screen and present in the
      // database, which is the one outcome worth undoing.
      setComments(previous);
      setError("Could not reach the server.");
    } finally {
      setDeleting(null);
    }
  }

  const count = comments.filter((c) => c.comment_type === "comment").length;

  return (
    <section
      id="doc-comments"
      style={{ marginTop: 56, paddingTop: 28, borderTop: "1px solid var(--border)" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <IconChat size={15} />
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize: 20,
            letterSpacing: "-0.01em",
          }}
        >
          Comments
        </h2>
        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
          {loadFailed ? "—" : count}
        </span>
      </div>

      {loadFailed ? (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
            padding: "12px 14px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--bg-card)",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            The comments could not be loaded. This doc may well have some — the thread just
            is not readable right now.
          </span>
          <button
            className="btn btn-secondary"
            onClick={retry}
            disabled={retrying}
            style={{ marginLeft: "auto" }}
          >
            {retrying ? "Retrying…" : "Try again"}
          </button>
        </div>
      ) : comments.length === 0 ? (
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-muted)" }}>
          No comments yet. {canComment ? "Ask a question, or @mention whoever owns this." : ""}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 24 }}>
          {comments.map((c) => {
            const trail = isReviewTrail(c.comment_type);
            const who = c.author_name ?? "Someone";
            const mine = Boolean(currentUserId && c.author_id === currentUserId);
            return (
              <div key={c.id} style={{ display: "flex", gap: 10 }}>
                <span
                  className="avatar avatar-sm"
                  style={{ background: avatarColor(who), flexShrink: 0, marginTop: 2 }}
                >
                  {who.charAt(0).toUpperCase()}
                </span>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                      marginBottom: 3,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                      {who}
                    </span>
                    {trail && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          fontStyle: "italic",
                        }}
                      >
                        {TRAIL_LABEL[c.comment_type as Exclude<CommentType, "comment">]}
                      </span>
                    )}
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      {formatRelative(c.created_at)}
                    </span>
                    {(mine || canModerate) && !trail && (
                      <button
                        onClick={() => remove(c.id)}
                        disabled={deleting !== null}
                        aria-label="Delete comment"
                        title="Delete comment"
                        style={{
                          marginLeft: "auto",
                          border: 0,
                          background: "transparent",
                          cursor: deleting ? "default" : "pointer",
                          opacity: deleting ? 0.4 : 1,
                          color: "var(--text-muted)",
                          padding: 2,
                          lineHeight: 0,
                        }}
                      >
                        <IconTrash size={12} />
                      </button>
                    )}
                  </div>

                  <div
                    style={
                      trail
                        ? {
                            borderLeft: "2px solid var(--border)",
                            paddingLeft: 10,
                          }
                        : undefined
                    }
                  >
                    <MentionedBody body={c.body} names={names} currentUserId={currentUserId} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canComment ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <MentionTextarea
            value={draft}
            onChange={setDraft}
            onMention={remember}
            onSubmit={post}
            candidates={candidates}
            disabled={busy}
            placeholder={
              membersFailed
                ? "Add a comment."
                : "Add a comment. Type @ to mention a teammate."
            }
          />
          {error && (
            <span style={{ fontSize: 12, color: "var(--stale-text)" }}>{error}</span>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
              {membersFailed ? (
                <>
                  The member list could not be loaded, so @mentions are unavailable.{" "}
                  <button
                    onClick={retry}
                    disabled={retrying}
                    style={{
                      border: 0,
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                      color: "var(--accent)",
                      font: "inherit",
                      textDecoration: "underline",
                    }}
                  >
                    {retrying ? "Retrying…" : "Retry"}
                  </button>
                </>
              ) : (
                "Mentioned teammates see it in their notifications."
              )}
            </span>
            <button
              className="btn btn-primary"
              onClick={post}
              disabled={busy || deleting !== null || draft.trim().length === 0}
            >
              {busy ? "Posting…" : "Comment"}
            </button>
          </div>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>
          Your role on this workspace is read-only, so you can follow the discussion but not add
          to it.
        </p>
      )}
    </section>
  );
}
