import { describe, it, expect, vi } from "vitest";
import { deliver, wants, webhookPayload, type WebhookEvent, type WebhookTarget } from "../webhook";

const event: WebhookEvent = {
  type: "mention",
  text: "Bea mentioned you",
  workspaceName: "Acme",
  docTitle: "Parental leave",
  docUrl: "https://aqli.example/w/acme/docs/d1",
  actorName: "Bea",
};

const target = (over: Partial<WebhookTarget> = {}): WebhookTarget => ({
  id: "wh1",
  url: "https://hooks.example/abc",
  events: [],
  ...over,
});

describe("webhookPayload", () => {
  it("writes one line a person can read, with the link", () => {
    const body = webhookPayload(event);
    expect(body.text).toBe("Bea mentioned you: Parental leave — https://aqli.example/w/acme/docs/d1");
  });

  it("sends the same line under both keys chat tools read", () => {
    // Slack and Teams read `text`; Discord reads `content`. Sending both costs
    // nothing and saves every customer from finding out we picked the other.
    const body = webhookPayload(event);
    expect(body.content).toBe(body.text);
  });

  it("carries a title and a link, never document content", () => {
    // A webhook lands in a channel whose membership nobody here controls, and a
    // private space's body has no business in it.
    const body = JSON.stringify(webhookPayload(event));
    expect(body).toContain("Parental leave");
    expect(body).not.toContain("body_md");
  });

  it("still says something useful when the app URL is not configured", () => {
    const body = webhookPayload({ ...event, docUrl: null });
    expect(body.text).toBe("Bea mentioned you: Parental leave");
  });
});

describe("wants", () => {
  it("treats an empty subscription as everything", () => {
    expect(wants(target(), "mention")).toBe(true);
    expect(wants(target(), "review_requested")).toBe(true);
  });

  it("honours a narrowed subscription", () => {
    expect(wants(target({ events: ["review_requested"] }), "mention")).toBe(false);
    expect(wants(target({ events: ["review_requested"] }), "review_requested")).toBe(true);
  });
});

describe("deliver", () => {
  it("posts JSON to every target that wants the event", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const results = await deliver(
      [target({ id: "a" }), target({ id: "b", url: "https://hooks.example/two" })],
      event,
      fetchImpl as unknown as typeof fetch,
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(results.map((r) => r.status)).toEqual([200, 200]);
  });

  it("skips a target that did not subscribe to this event", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await deliver([target({ events: ["review_requested"] })], event, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("records a rejection rather than throwing", async () => {
    // The comment being announced has already happened; a chat tool being down
    // must not undo it.
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const [result] = await deliver([target()], event, fetchImpl as unknown as typeof fetch);
    expect(result).toMatchObject({ id: "wh1", status: 404 });
    expect(result.error).toContain("404");
  });

  it("records an unreachable endpoint rather than throwing", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));
    const [result] = await deliver([target()], event, fetchImpl as unknown as typeof fetch);
    expect(result).toMatchObject({ id: "wh1", status: null });
    expect(result.error).toContain("ENOTFOUND");
  });

  it("keeps delivering to the others when one target fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const results = await deliver(
      [target({ id: "a" }), target({ id: "b" })],
      event,
      fetchImpl as unknown as typeof fetch,
    );
    expect(results.map((r) => r.status)).toEqual([null, 200]);
  });
});
