/**
 * Is email confirmation on for this project?
 *
 * GoTrue answers this on `/auth/v1/settings`, which is public and needs only
 * the anon key. There is no SQL for it — the setting lives in the auth
 * service's configuration, not in a table — so this is the one check that has
 * to leave the database.
 *
 * Never throws: a preflight that dies because one probe timed out is worse
 * than one that reports "could not tell" for a single line.
 */
export type AuthSettings = { mailerAutoconfirm: boolean | null };

export async function readAuthSettings(
  supabaseUrl: string | undefined,
  anonKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<AuthSettings> {
  if (!supabaseUrl || !anonKey) return { mailerAutoconfirm: null };

  try {
    const res = await fetchImpl(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (!res.ok) return { mailerAutoconfirm: null };

    const body = (await res.json()) as { mailer_autoconfirm?: unknown };
    return {
      mailerAutoconfirm: typeof body.mailer_autoconfirm === "boolean" ? body.mailer_autoconfirm : null,
    };
  } catch {
    return { mailerAutoconfirm: null };
  }
}
