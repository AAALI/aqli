import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Request-scoped Supabase client bound to the user's auth cookies.
 * All queries run with the signed-in user's identity and respect RLS.
 *
 * Memoised per request with React `cache`: a page render reaches this from
 * the layout, the page and every `lib/supabase` helper they call, and each
 * call used to build a fresh client from the cookie jar. One per request is
 * enough; outside a React request (a route handler) `cache` is a no-op and
 * the function simply runs.
 */
export const createServerSupabaseClient = cache(async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
            // Middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
});

/**
 * The signed-in user, once per request.
 *
 * `auth.getUser()` is not a cookie read: it is a round trip to Supabase Auth
 * to verify the token. A document page was making that trip three or four
 * times — the layout, the page, the role lookup, the read receipt — and a
 * list page about as many, every one of them serial with what came after.
 * The middleware has already refreshed the session by the time a Server
 * Component runs, so one verification per request is all a page needs.
 */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// The service-role client used to live here. It now lives in `lib/db`, where
// `scoped(workspaceId)` appends the workspace predicate to every query
// automatically and `unscoped(reason)` makes the exceptions say why (spec
// §2.4). An ESLint rule keeps it there.
