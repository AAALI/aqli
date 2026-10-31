# Authentication setup

Aqli defaults to one email field, followed by a message containing a sign-in
link and a six-digit code. Existing password accounts are unchanged: choose
**Use password instead** on sign-in. Signup does not ask for a password.

## Before deploying

1. Enable the Email auth provider and keep **Confirm email** enabled.
2. Configure and test custom SMTP in Supabase Auth, including sender-domain
   authentication and delivery to your team's actual mail providers. The
   built-in hosted SMTP service is for testing, restricts delivery to project
   team members, and has very low quotas, not a production mail guarantee.
3. Set the Supabase Site URL to the application's trusted origin and allow its
   `/auth/callback` redirects, including the `next` query string. Test the
   actual login and invitation callback URLs against the redirect allowlist.
   Do not allow arbitrary external origins.
4. Update **both Confirm signup and Magic link** email templates as below.
   New and existing accounts may receive different templates.
5. Review email-send, per-address OTP, and verification rate limits. Aqli
   waits 60 seconds before offering a resend; Supabase still enforces the real
   limits and may require longer. Its documented defaults are a 60-second
   per-address resend window and a one-hour email OTP expiry. These are
   configurable, so the UI does not promise a fixed expiry time. Keep email
   OTP length at six digits for Aqli's code field.

There is no checked-in Supabase `config.toml` or deployed mail template in this
repository. Operators must configure their own hosted/self-hosted Supabase.
SMTP credentials stay in Supabase configuration, never `NEXT_PUBLIC_*`.
The app's `.env.example` is not a mail-server configuration file.

## One email, two ways in

Use this body for **Confirm signup** and **Magic link**, with a short subject
such as “Sign in to Aqli”:

```html
<h2>Sign in to Aqli</h2>
<p><a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=email">Sign in to Aqli</a></p>
<p>Or enter this six-digit code in Aqli: <strong>{{ .Token }}</strong></p>
<p>Use the newest message. The link and code expire and can only be used once.</p>
<p>If you did not request this email, you can ignore it.</p>
```

`emailRedirectTo` is always Aqli's `/auth/callback?next=...`, so this template
appends the token hash while retaining the workspace invitation or onboarding
destination. The callback verifies `token_hash` with `type: 'email'`, writes
the session cookies, and redirects only to a same-origin relative path.
This custom link does not require a verifier cookie from the requesting
browser. Never log the link, code, token hash, or resulting session.

Legacy `{{ .ConfirmationURL }}` links still work through Supabase's
verification endpoint and Aqli's PKCE `code` exchange, but generally require
the browser that requested them. Include `{{ .Token }}` even when retaining a
legacy link so users have a code fallback. Email link scanners can consume a
one-time link before a person opens it; users may need a fresh email.
Disable email-provider click tracking that rewrites authentication links.

For another-browser code entry, open the same invitation URL, or sign-in/signup
page with its `next` destination, enter the email address and choose
**I already have a code**. This verifies the existing code without sending a
new email or requiring the original browser's PKCE verifier.

## Existing accounts and invitations

- Login uses `signInWithOtp({ options: { shouldCreateUser: false } })`. Unknown
  addresses see a readable prompt to create an account or use their workspace
  invitation. This deliberately trades account-enumeration resistance for
  clear recovery in an invite-based team tool.
- Signup and invitation authentication use `shouldCreateUser: true`. Existing
  email identities are signed in, not recreated. No existing password is
  changed or removed.
- Both routes verify codes with `verifyOtp({ email, token, type: 'email' })`.
  Code entry works independently of the browser that requested the email.
- After authentication, a full navigation reads the cookie session and
  re-derives onboarding progress. Existing members are sent to their existing
  workspace, not asked to create a duplicate one.
- An invitation returns to `/invite?token=...` after authentication. The
  authenticated user explicitly joins; the existing invitation RPC still
  validates the invited address and membership rules.

The browser client uses `@supabase/ssr`, which defaults to PKCE and cookie
storage, not implicit-flow URL fragments. OAuth and legacy PKCE callback
support remain. Email code verification returns a session directly and does
not need the PKCE verifier. APIs were checked against the dependencies
declared in `package.json`: `@supabase/supabase-js` `^2.107.0` and
`@supabase/ssr` `^0.10.3`. No dependency upgrade is required.

## Rollout checks

Before relying on passwordless access, test with actual new and existing
accounts:

- Delivery, spam placement, expired/invalid code feedback and rate limits.
- Code entry by paste and Enter, resend after cooldown, and a different email.
- Link and code separately, including code and custom-link entry in a second
  browser/device. Using either consumes the one-time credential.
- A pending workspace invitation and interrupted onboarding, preserving `next`.
- The existing password sign-in fallback.

Local development still needs mail delivery or a mail catcher/inbox from the
Supabase environment. Turning **Confirm email** off does not make
`signInWithOtp` return an immediate authenticated session. Production
`pnpm preflight` continues to flag disabled confirmation, but it does not
replace an actual end-to-end SMTP/template delivery test.

## Official references

- [Passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [SSR and PKCE behavior](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp)
- [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)
