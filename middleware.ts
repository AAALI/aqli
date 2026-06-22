import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup"];

/**
 * Refreshes the Supabase auth session on every request and gates /w/* routes.
 *
 * This middleware is load-bearing, not optional. Supabase access tokens are
 * short-lived and rotate; only here can we write the refreshed token back to
 * the response cookies. Server Components get a read-only cookie store, so their
 * `setAll` is a no-op (see lib/supabase/server.ts). Without this middleware,
 * every Server Component client re-attempts a token refresh against /token on
 * each render — a single page renders ~8 clients — which trips Supabase's auth
 * rate limiter (429) and makes RLS-backed pages fail intermittently.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the session and, via setAll above, persists rotated tokens.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Unauthenticated users hitting app routes -> login.
  if (!user && !isPublic && pathname.startsWith("/w/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Signed-in users hitting auth pages -> their workspace resolver.
  if (user && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image files, so the
     * session is refreshed before any page or API route reads it.
     */
    "/((?!_next/static|_next/image|ingest|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
