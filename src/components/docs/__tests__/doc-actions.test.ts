import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, useEffect, type ReactElement, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import type { DocWithSpace } from "@/types/doc";
import type { Trust } from "@/lib/trust";
import type { Space } from "@/types/space";
import type { DocCommentView } from "@/types/comment";

// Exercise the rendered controls and their async state transitions without a
// browser or Supabase. Each render preserves hook slots like a mounted client.
const hooks = vi.hoisted(() => ({ cursor: 0, slots: [] as unknown[] }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const images = vi.hoisted(() => ({ uploading: 0, error: null, attach: vi.fn() }));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  function memo(factory: () => unknown, deps: unknown[]) {
    const i = hooks.cursor++;
    const cached = hooks.slots[i] as { value: unknown; deps: unknown[] } | undefined;
    if (!cached || deps.some((dep, j) => !Object.is(dep, cached.deps[j]))) {
      hooks.slots[i] = { value: factory(), deps };
    }
    return (hooks.slots[i] as { value: unknown }).value;
  }
  return {
    ...actual,
    useState(initial: unknown) {
      const i = hooks.cursor++;
      if (!(i in hooks.slots)) hooks.slots[i] = typeof initial === "function" ? initial() : initial;
      return [hooks.slots[i], (value: unknown) => {
        hooks.slots[i] = typeof value === "function" ? value(hooks.slots[i]) : value;
      }];
    },
    useRef: (initial: unknown) => memo(() => ({ current: initial }), []),
    useMemo: memo,
    useCallback: (callback: unknown, deps: unknown[]) => memo(() => callback, deps),
    useEffect: vi.fn(),
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@tiptap/react", () => ({
  useEditor: () => ({ getJSON: () => ({ type: "doc", content: [{ type: "paragraph" }] }) }),
  EditorContent: () => null,
}));
vi.mock("@/components/editor/MermaidCodeBlock", () => ({ CodeBlockWithMermaid: {} }));
vi.mock("@/components/editor/useDocImages", () => ({ useDocImages: () => images }));
vi.mock("@/lib/markdown/schema", () => ({ aqliExtensions: () => [] }));
vi.mock("@/lib/markdown/md-to-tiptap", () => ({ markdownToTiptap: () => ({ type: "doc", content: [] }) }));
vi.mock("@/lib/markdown/tiptap-to-md", () => ({ tiptapToMarkdown: () => "" }));

const { default: TrustLine } = await import("../TrustLine");
const { ArchiveButton } = await import("../DocLifecycle");
const { default: PublishSheet } = await import("../PublishSheet");
const { default: DocEditorClient } = await import("@/app/(app)/w/[workspace]/(doc)/docs/[id]/edit/DocEditorClient");
const { default: HistoryClient } = await import("@/app/(app)/w/[workspace]/(doc)/docs/[id]/history/HistoryClient");
const { default: ChecksClient } = await import("@/app/(app)/w/[workspace]/(main)/checks/ChecksClient");
const { default: DocComments } = await import("../DocComments");
const { default: MentionTextarea } = await import("../MentionTextarea");
const { default: ShareButton } = await import("../ShareButton");
const { default: SelectionToolbar } = await import("@/components/editor/v2/SelectionToolbar");
const { default: SlashMenu } = await import("@/components/editor/v2/SlashMenu");

type Props = Record<string, unknown> & { children?: ReactNode };
type Element = ReactElement<Props>;
function elements(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function textOf(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<Props>(node)) return textOf(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}
function render(component: () => ReactNode) {
  hooks.cursor = 0;
  return component();
}
function button(tree: ReactNode, label: string) {
  const found = elements(tree).find((el) => el.type === "button" && textOf(el) === label);
  if (!found) throw new Error(`No button: ${label}`);
  return found;
}
async function click(el: Element) {
  await (el.props.onClick as (event: { preventDefault: () => void; stopPropagation: () => void }) => unknown)({
    preventDefault() {}, stopPropagation() {},
  });
}
function changeTitle(tree: ReactNode, title: string) {
  const input = elements(tree).find((el) => el.type === "textarea" && el.props["aria-label"] === "Title")!;
  (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: title } });
}
function deferredResponse() {
  let resolve!: (res: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  hooks.cursor = 0;
  hooks.slots = [];
  images.uploading = 0;
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("document action feedback", () => {
  it("reports a refused clipboard write and keeps Share retryable", async () => {
    vi.stubGlobal("window", { location: { href: "https://aqli.test/w/test/docs/doc1" } });
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } });
    const view = () => render(() => ShareButton());
    await click(button(view(), "Share"));
    expect(button(view(), "Retry copy").props.title).toContain("Could not copy the link");
  });

  it("keeps confirmation retryable after an offline request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(Response.json({})));
    const trust: Trust = { state: "unverified", lead: "Waiting", person: null, tail: "", action: "confirm" };
    const view = () => render(() => TrustLine({ docId: "doc1", trust }));
    await click(button(view(), "Confirm it's still true"));
    expect(textOf(view())).toContain("Didn't go through. Try again.");
    await click(button(view(), "Confirm it's still true"));
    expect(textOf(view())).not.toContain("Didn't go through");
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("shows an archive refusal inside the active confirmation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Cannot archive" }, { status: 403 })));
    const view = () => render(() => {
      const outer = ArchiveButton({ docId: "doc1" });
      return (outer.type as (props: typeof outer.props) => ReactNode)(outer.props);
    });
    await click(button(view(), "Archive"));
    await click(button(view(), "Archive"));
    await vi.waitFor(() => expect(textOf(view())).toContain("Cannot archive"));
    expect(button(view(), "Cancel")).toBeDefined();
    expect(button(view(), "Archive").props.disabled).not.toBe(true);
  });

  it("shows Checks network errors instead of silently losing the action", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    const view = () => render(() => ChecksClient({
      base: "/w/test",
      items: [{ kind: "doc", id: "doc1", title: "Doc", space: null, minutes: 1,
        askedAt: "2026-10-01", asker: "Writer", askedYou: true, others: [], changes: [],
        changedFrom: null, excerpt: "" }],
    }));
    await click(button(view(), "Not my call"));
    expect(textOf(view())).toContain("Could not reach the server. Try again.");
    expect(button(view(), "Not my call").props.disabled).toBe(false);
  });
});

describe("publish sheet", () => {
  const space = (id: string, review_policy: Space["review_policy"]) => ({
    id, name: id, review_policy, icon: "book",
  } as Space);

  it("explains why canon cannot publish into review_all, then enables an open destination", async () => {
    const view = () => render(() => PublishSheet({
      title: "Doc", spaces: [space("Reviewed", "review_all"), space("Open", "open")],
      people: [], initialSpaceId: "Reviewed", busy: false, error: null,
      onCancel() {}, onPublish() {},
    }));
    expect(textOf(view())).toContain("This space requires review.");
    expect(elements(view()).find((el) => el.type === "button" && el.props.className === "btn btn-primary")?.props.disabled).toBe(true);
    await click(button(view(), "Open"));
    expect(textOf(view())).not.toContain("Direct publishing is unavailable");
    expect(elements(view()).find((el) => el.type === "button" && el.props.className === "btn btn-primary")?.props.disabled).toBe(false);
  });

  it("keeps the record exemption consistent with server disposition", () => {
    const tree = render(() => PublishSheet({
      title: "Record", spaces: [space("Reviewed", "review_all")], docClass: "record",
      people: [], initialSpaceId: "Reviewed", busy: false, error: null,
      onCancel() {}, onPublish() {},
    }));
    expect(textOf(tree)).not.toContain("Direct publishing is unavailable");
    expect(elements(tree).find((el) => el.type === "button" && el.props.className === "btn btn-primary")?.props.disabled).toBe(false);
  });
});

describe("comment mutations", () => {
  it("does not let deletion roll back a comment posted in the meantime", async () => {
    const request = deferredResponse();
    const fetch = vi.fn().mockReturnValue(request.promise);
    vi.stubGlobal("fetch", fetch);
    const initial: DocCommentView = {
      id: "comment1", doc_id: "doc1", workspace_id: "ws1", author_id: "writer",
      author_name: "Writer", body: "Existing", comment_type: "comment",
      mentions: [], created_at: "2026-10-01",
    };
    const view = () => render(() => DocComments({
      docId: "doc1", initial: [initial], names: {}, threadFailed: false,
      members: [], membersFailed: false, currentUserId: "writer", canComment: true, canModerate: false,
    }));
    const composer = elements(view()).find((el) => el.type === MentionTextarea)!;
    (composer.props.onChange as (text: string) => void)("New comment");
    const posting = click(button(view(), "Comment"));
    const remove = elements(view()).find((el) => el.props["aria-label"] === "Delete comment")!;
    expect(remove.props.disabled).toBe(true);
    await click(remove);
    expect(fetch).toHaveBeenCalledOnce();
    request.resolve(Response.json({ comment: { ...initial, id: "comment2", body: "New comment" } }));
    await posting;
    expect(elements(view()).filter((el) => typeof el.props.body === "string").map((el) => el.props.body))
      .toEqual(["Existing", "New comment"]);
  });
});

const version = (id: string, n: number) => ({
  id, n, total: 2, label: "Edited", who: "Writer", byAgent: false,
  at: "2026-10-01", prose: "", body_md: "Body", before: null,
});
function history() {
  return render(() => HistoryClient({ workspaceSlug: "test", docId: "doc1", docTitle: "Doc",
    spaceName: null, spaceSlug: null, versions: [version("v2", 2), version("v1", 1)],
    initial: "v1", canRestore: true }));
}

describe("history restoration", () => {
  it("stays on history and enables retry when the server refuses restoration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Access denied" }, { status: 403 })));
    await click(button(history(), "Restore this version"));
    expect(router.push).not.toHaveBeenCalled();
    expect(textOf(history())).toContain("Access denied");
    expect(button(history(), "Restore this version").props.disabled).toBe(false);
  });

  it("reports 202 as a proposal, not an applied restoration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({}, { status: 202 })));
    await click(button(history(), "Restore this version"));
    expect(router.push).not.toHaveBeenCalled();
    expect(textOf(history())).toContain("Restoration sent for review. The current doc has not changed.");
    expect(button(history(), "Sent for review").props.disabled).toBe(true);
  });

  it("returns to the reading surface only after an applied restoration", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));
    await click(button(history(), "Restore this version"));
    expect(router.push).toHaveBeenCalledWith("/w/test/docs/doc1");
  });
});

const doc = { id: "doc1", title: "Old", status: "draft", workspace_id: "ws1",
  space_id: null, space: null, body_md: null } as unknown as DocWithSpace;
function editor() {
  return render(() => DocEditorClient({ doc, workspaceSlug: "test", spaces: [], people: [], canPublish: true }));
}
function publish(tree: ReactNode) {
  const sheet = elements(tree).find((el) => el.type === PublishSheet);
  if (!sheet) throw new Error("Publish sheet not open");
  return (sheet.props.onPublish as (choice: { spaceId: null; checkerIds: string[] }) => Promise<void>)({
    spaceId: null, checkerIds: [],
  });
}
function publishError(tree: ReactNode) {
  return elements(tree).find((el) => el.type === PublishSheet)?.props.error;
}

describe("publish waits for saved content", () => {
  it("queues a focused title immediately and refuses to publish after its failed save", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi.fn().mockResolvedValue(Response.json({}, { status: 500 }));
    vi.stubGlobal("fetch", fetch);
    const tree = editor();
    changeTitle(tree, "Latest title");
    await click(button(editor(), "Publish"));
    await publish(editor());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/docs/doc1");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ title: "Latest title" });
    expect(publishError(editor())).toContain("Your latest changes could not be saved.");
    expect(button(editor(), "Retry save")).toBeDefined();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("awaits an already-running title save before sending the publish request", async () => {
    vi.useFakeTimers();
    const saving = deferredResponse();
    const fetch = vi.fn().mockReturnValueOnce(saving.promise).mockResolvedValueOnce(Response.json({}));
    vi.stubGlobal("fetch", fetch);
    changeTitle(editor(), "Latest title");
    await vi.advanceTimersByTimeAsync(2000);
    await click(button(editor(), "Publish"));
    const publishing = publish(editor());
    expect(fetch).toHaveBeenCalledTimes(1);
    saving.resolve(Response.json({}));
    await publishing;
    expect(fetch.mock.calls.map((args) => args[0])).toEqual(["/api/docs/doc1", "/api/docs/doc1/publish"]);
    expect(router.push).toHaveBeenCalledWith("/w/test/docs/doc1");
  });

  it("does not publish an unchanged draft when the save became a review proposal", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue(Response.json({}, { status: 202 }));
    vi.stubGlobal("fetch", fetch);
    changeTitle(editor(), "Queued title");
    await click(button(editor(), "Publish"));
    await publish(editor());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(publishError(editor())).toContain("Your changes were sent for review.");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("preserves the autosave timer when publishing is blocked by image upload", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetch);
    images.uploading = 1;
    changeTitle(editor(), "Do not lose this title");
    await click(button(editor(), "Publish"));
    await publish(editor());
    expect(publishError(editor())).toContain("Wait for the images");
    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][0]).toBe("/api/docs/doc1");
  });
});

function editorActionsFixture() {
  const handlers = new Map<string, () => void>();
  let onKey: (event: KeyboardEvent) => boolean = () => false;
  const chain = {
    focus: vi.fn().mockReturnThis(),
    deleteRange: vi.fn().mockReturnThis(),
    insertContentAt: vi.fn().mockReturnThis(),
    run: vi.fn().mockReturnValue(true),
  };
  const selection = {
    from: 1, to: 5, empty: false,
    $from: { pos: 6, parentOffset: 5, parent: {
      isTextblock: true, type: { name: "paragraph" },
      textBetween: () => "/cite", textContent: "Context for citation",
    } },
  };
  const props = {
    editor: {
      on: (name: string, callback: () => void) => { handlers.set(name, callback); },
      off: vi.fn(),
      state: { selection, doc: { textBetween: () => "Selected passage" } },
      view: { coordsAtPos: () => ({ top: 100, bottom: 120, left: 200 }) },
      isEditable: true,
      chain: () => chain,
    } as unknown as Editor,
    containerRef: { current: {
      scrollTop: 0, getBoundingClientRect: () => ({ top: 0, left: 0, width: 700, height: 800 }),
    } as HTMLDivElement },
    keyRegistry: { register: (handler: (event: KeyboardEvent) => boolean) => { onKey = handler; return () => {}; } },
    workspaceId: "ws1", docId: "doc1", docTitle: "Doc", base: "/w/test", onAskAgent() {},
  };
  function view(component: typeof SelectionToolbar | typeof SlashMenu) {
    vi.mocked(useEffect).mockClear();
    const tree = render(() => component(props));
    for (const [effect] of vi.mocked(useEffect).mock.calls) effect();
    return tree;
  }
  return { props, selection, handlers, chain, view, key: (key: string) => onKey({ key } as KeyboardEvent) };
}
function actionButton(tree: ReactNode, label: string) {
  const found = elements(tree).find((el) => el.type === "button" && textOf(el).startsWith(label));
  if (!found) throw new Error(`No action: ${label}`);
  return found;
}

describe("editor AI action failures", () => {
  it("keeps rewrite errors visible and retries the same action without changing the passage first", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: "Rewrite service unavailable" }, { status: 502 }))
      .mockResolvedValueOnce(Response.json({ text: "Rewritten" }));
    vi.stubGlobal("fetch", fetch);
    const fixture = editorActionsFixture();
    const view = () => fixture.view(SelectionToolbar);
    view();
    fixture.handlers.get("selectionUpdate")!();
    await click(actionButton(view(), "Tighten"));
    expect(textOf(view())).toContain("Rewrite service unavailable");
    expect(fixture.chain.insertContentAt).not.toHaveBeenCalled();
    await click(button(view(), "Try again"));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[1][1].body).action).toBe("tighten");
    expect(fixture.chain.insertContentAt).toHaveBeenCalledOnce();
    expect(view()).toBeNull();
  });

  it.each([{}, { text: "" }, { text: 42 }])("treats an unusable rewrite payload %j as a visible failure", async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
    const fixture = editorActionsFixture();
    const view = () => fixture.view(SelectionToolbar);
    view();
    fixture.handlers.get("selectionUpdate")!();
    await click(actionButton(view(), "Expand"));
    expect(textOf(view())).toContain("The rewrite returned no text.");
    expect(button(view(), "Try again")).toBeDefined();
    expect(fixture.chain.insertContentAt).not.toHaveBeenCalled();
  });

  it("does not present failed selection citation search as no matching documents", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce(Response.json({ results: [] }));
    vi.stubGlobal("fetch", fetch);
    const fixture = editorActionsFixture();
    const view = () => fixture.view(SelectionToolbar);
    view();
    fixture.handlers.get("selectionUpdate")!();
    await click(actionButton(view(), "Cite"));
    expect(textOf(view())).toContain("Offline");
    expect(textOf(view())).not.toContain("No approved docs matched");
    await click(button(view(), "Try again"));
    expect(textOf(view())).toContain("No approved docs matched this passage.");
    expect(textOf(view())).not.toContain("Offline");
  });

  it("shows slash citation HTTP errors and lets Enter retry instead of claiming no documents exist", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ error: "Search unavailable" }, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ results: [] }));
    vi.stubGlobal("fetch", fetch);
    const fixture = editorActionsFixture();
    fixture.selection.empty = true;
    const view = () => fixture.view(SlashMenu);
    view();
    fixture.handlers.get("transaction")!();
    fixture.chain.run.mockImplementationOnce(() => {
      fixture.selection.$from.parent.textBetween = () => "";
      fixture.handlers.get("transaction")!();
      return true;
    });
    await click(actionButton(view(), "Cite a doc"));
    await vi.waitFor(() => expect(textOf(view())).toContain("Search unavailable"));
    expect(textOf(view())).not.toContain("Nobody has written this down");
    expect(button(view(), "Try again")).toBeDefined();
    expect(fixture.key("Enter")).toBe(true);
    await vi.waitFor(() => expect(textOf(view())).toContain("Nobody has written this down."));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("offers retry for an invalid slash citation response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));
    const fixture = editorActionsFixture();
    fixture.selection.empty = true;
    const view = () => fixture.view(SlashMenu);
    view();
    fixture.handlers.get("transaction")!();
    await click(actionButton(view(), "Cite a doc"));
    await vi.waitFor(() => expect(textOf(view())).toContain("Could not read the related docs."));
    expect(button(view(), "Try again")).toBeDefined();
  });
});
