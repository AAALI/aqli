import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { safeAuthNext } from "@/lib/auth/email";

/**
 * Accepts token-hash email links (including from another browser), plus legacy
 * PKCE links and OAuth codes. Neither failure nor a missing code proves that
 * an email was confirmed, so fallback copy never claims that it was.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeAuthNext(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");

  if (code || (tokenHash && searchParams.get("type") === "email")) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = tokenHash && searchParams.get("type") === "email"
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" })
        : await supabase.auth.exchangeCodeForSession(code!);
      if (!error && data.session) {
        const response = NextResponse.redirect(new URL(next, origin));
        response.headers.set("Cache-Control", "private, no-store");
        response.headers.set("Referrer-Policy", "no-referrer");
        return response;
      }
    } catch {
      // A retryable auth outage still gets a usable sign-in screen.
    }
  }

  const login = new URL("/login", origin);
  login.searchParams.set("notice", "link_failed");
  if (next !== "/") login.searchParams.set("next", next);
  const response = NextResponse.redirect(login);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
