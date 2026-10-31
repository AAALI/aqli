/** Only relative, same-origin destinations may survive an auth round trip. */
export function safeAuthNext(value: string | null | undefined, fallback = "/"): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return fallback;
  return value;
}

export function emailCallbackUrl(origin: string, next: string): string {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", safeAuthNext(next));
  return url.toString();
}

export function authPageHref(page: "/login" | "/signup", next?: string | null): string {
  const destination = safeAuthNext(next);
  return destination === "/" ? page : `${page}?${new URLSearchParams({ next: destination })}`;
}

export function emailAuthError(error: unknown, operation: "send" | "verify" | "password", createUser = false): string {
  const details = error && typeof error === "object" ? error as { code?: string; status?: number; message?: string; name?: string } : {};
  if (details.status === 429 || details.code?.includes("rate_limit")) return "Too many attempts. Wait a minute before trying again.";
  if (details.code === "otp_disabled" || /signups? (?:not allowed|disabled)/i.test(details.message ?? "")) {
    return createUser
      ? "New accounts aren't enabled on this installation. Ask your admin for access."
      : "No account is available for this email. Create an account or use your workspace invitation.";
  }
  if (details.code === "otp_expired" || details.code === "otp_invalid") return "That code or link is invalid, expired, or already used. Request a new email and use the latest code.";
  if (details.name === "AuthRetryableFetchError" || error instanceof TypeError) return "Couldn't reach the sign-in service. Check your connection and try again.";
  if (operation === "verify") return "That code couldn't be verified. Check the latest email, or request a new one.";
  if (operation === "password") return "Couldn't sign in with that email and password. Try again or use an email link instead.";
  return "Couldn't send the sign-in email. Try again, or contact your workspace admin if it keeps happening.";
}
