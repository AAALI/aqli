import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ verifyOtp: vi.fn(), exchangeCode: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { verifyOtp: mocks.verifyOtp, exchangeCodeForSession: mocks.exchangeCode },
  }),
}));
const { GET } = await import("../route");
const next = "/invite?token=invite-token";
const callback = (params: Record<string, string>) => new NextRequest(
  `https://aqli.example/auth/callback?${new URLSearchParams(params)}`,
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyOtp.mockResolvedValue({ data: { session: { access_token: "test-session" } }, error: null });
  mocks.exchangeCode.mockResolvedValue({ data: { session: { access_token: "test-session" } }, error: null });
});

describe("auth callback", () => {
  it("verifies a custom email link without relying on the original browser's PKCE verifier", async () => {
    const response = await GET(callback({ token_hash: "test-token-hash", type: "email", next }));
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "test-token-hash", type: "email" });
    expect(mocks.exchangeCode).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(`https://aqli.example${next}`);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("keeps legacy PKCE/OAuth code exchange and onboarding destinations", async () => {
    const response = await GET(callback({ code: "test-auth-code", next: "/signup?step=workspace" }));
    expect(mocks.exchangeCode).toHaveBeenCalledWith("test-auth-code");
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://aqli.example/signup?step=workspace");
  });

  it("retains next on link failure without falsely claiming the email was confirmed", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: null }, error: { code: "otp_expired" } });
    const response = await GET(callback({ token_hash: "test-token-hash", type: "email", next }));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe(next);
    expect(location.searchParams.get("notice")).toBe("link_failed");
    expect(location.searchParams.has("token_hash")).toBe(false);
  });

  it("offers the same fallback on a thrown authentication outage", async () => {
    mocks.exchangeCode.mockRejectedValue(new Error("Offline"));
    const response = await GET(callback({ code: "test-auth-code", next }));
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("notice")).toBe("link_failed");
    expect(location.searchParams.get("next")).toBe(next);
  });

  it.each(["https://other.example/path", "//other.example/path", "/\\other.example/path"])("refuses an external next destination: %s", async (unsafe) => {
    const response = await GET(callback({ code: "test-auth-code", next: unsafe }));
    expect(response.headers.get("location")).toBe("https://aqli.example/");
  });

  it("does not accept arbitrary token-hash types or authenticate a missing credential", async () => {
    const response = await GET(callback({ token_hash: "test-token-hash", type: "recovery", next }));
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.exchangeCode).not.toHaveBeenCalled();
    expect(new URL(response.headers.get("location")!).searchParams.get("notice")).toBe("link_failed");
  });

  it("does not redirect as authenticated when an auth response has no session", async () => {
    mocks.exchangeCode.mockResolvedValue({ data: { session: null }, error: null });
    const response = await GET(callback({ code: "test-auth-code", next }));
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });
});
