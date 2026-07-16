import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Auth callback for Supabase email links (signup confirmation, magic links,
 * password recovery). The email link hits Supabase's /auth/v1/verify, which
 * confirms the token and redirects here with a PKCE `?code=`. We exchange it
 * for a session (cookies are written by the route handler) and send the user
 * on to `next` — e.g. /signup?step=workspace to resume onboarding, or
 * /invite?token=… to finish joining a workspace.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  // Only allow same-origin relative redirects.
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // Exchange failed (e.g. the link was opened in a different browser than the
  // one that signed up, so the PKCE verifier cookie is missing). The email is
  // already confirmed at this point — signing in will pick things up.
  const login = new URL("/login", origin);
  login.searchParams.set("notice", "confirmed");
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
