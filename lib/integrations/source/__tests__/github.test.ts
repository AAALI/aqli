import { describe, it, expect } from "vitest";
import { verifyWebhookSignature, newWebhookSecret } from "../github";

const SECRET = "a".repeat(64);

/** GitHub's own signing, reproduced so the tests sign the way it does. */
async function sign(payload: string, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
  );
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256=${hex}`;
}

describe("verifyWebhookSignature", () => {
  const payload = JSON.stringify({ action: "closed", hello: "world" });

  it("accepts a correctly signed delivery", async () => {
    const signature = await sign(payload);
    expect(await verifyWebhookSignature({ payload, signature, secret: SECRET })).toBe(true);
  });

  it("rejects a body altered after signing", async () => {
    const signature = await sign(payload);
    const tampered = payload.replace("world", "wOrld");
    expect(
      await verifyWebhookSignature({ payload: tampered, signature, secret: SECRET }),
    ).toBe(false);
  });

  it("rejects a signature made with a different secret", async () => {
    // The cross-tenant case: another workspace's secret must not validate here.
    const signature = await sign(payload, "b".repeat(64));
    expect(await verifyWebhookSignature({ payload, signature, secret: SECRET })).toBe(false);
  });

  it("rejects a missing signature rather than skipping the check", async () => {
    expect(await verifyWebhookSignature({ payload, signature: null, secret: SECRET })).toBe(false);
    expect(await verifyWebhookSignature({ payload, signature: "", secret: SECRET })).toBe(false);
  });

  it("rejects a signature without the sha256 prefix", async () => {
    const full = await sign(payload);
    const bare = full.slice("sha256=".length);
    expect(await verifyWebhookSignature({ payload, signature: bare, secret: SECRET })).toBe(false);
    expect(
      await verifyWebhookSignature({ payload, signature: `sha1=${bare}`, secret: SECRET }),
    ).toBe(false);
  });

  it("rejects malformed hex instead of throwing", async () => {
    for (const bad of ["sha256=", "sha256=zz", "sha256=abc", "sha256=" + "g".repeat(64)]) {
      expect(await verifyWebhookSignature({ payload, signature: bad, secret: SECRET })).toBe(false);
    }
  });

  it("rejects a truncated signature that is a prefix of the real one", async () => {
    const full = await sign(payload);
    const truncated = full.slice(0, full.length - 2);
    expect(
      await verifyWebhookSignature({ payload, signature: truncated, secret: SECRET }),
    ).toBe(false);
  });

  it("refuses when no secret is configured", async () => {
    // A connection with no stored secret must reject every delivery, not
    // verify against the empty string. The guard also keeps `importKey` from
    // throwing — Web Crypto rejects a zero-length HMAC key outright, so
    // without the early return this would be a 500 rather than a 401.
    const signature = await sign(payload);
    expect(await verifyWebhookSignature({ payload, signature, secret: "" })).toBe(false);
  });

  it("is sensitive to whitespace, which is why the raw body is verified", async () => {
    // Re-serialising parsed JSON is the classic way to break this: same data,
    // different bytes, different digest.
    const signature = await sign(payload);
    const reserialized = JSON.stringify(JSON.parse(payload), null, 2);
    expect(
      await verifyWebhookSignature({ payload: reserialized, signature, secret: SECRET }),
    ).toBe(false);
  });
});

describe("newWebhookSecret", () => {
  it("is 256 bits of hex and not repeated", () => {
    const a = newWebhookSecret();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(newWebhookSecret());
  });
});
