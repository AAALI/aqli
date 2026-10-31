# UI audit

Date: 2026-10-31. Source review and integrated UI/passwordless validation complete.

## Scope and evidence

Static review covered navigation, Home, spaces, Drafts, search, editor/publish,
reading/history, Checks/comments, auth, and settings controls. Controls were
traced to local routes, request handlers, or custom-event listeners. A separate
review checked the navigation, landing, document-interaction, and settings/auth diffs.

Browser QA covered public landing, login, signup account step, privacy, terms,
invalid invitation, and unauthenticated workspace redirects at desktop, tablet,
and mobile widths. Public-page screenshots are in
`reports/ui-audit/screenshots/`.

**Authenticated runtime testing is blocked:** no Supabase configuration or test
account is available. Public-page QA used a deliberately
nonfunctional loopback Supabase URL. No real account, document, or integration
was changed. Static wiring and unit checks do not establish live RLS, publishing,
import, or external-service correctness.

## Fixes reviewed in source

| Area | Verified behavior in the current diff | Main files |
| --- | --- | --- |
| Navigation | Active states match route boundaries, including space slugs that share prefixes; compact-sidebar controls have names. | `src/components/layout/Sidebar.tsx` |
| Create space | Failed requests stay visible in the dialog; duplicate submissions are guarded; Enter submits the form; busy inputs cannot change the request. | `src/components/layout/NewSpaceButton.tsx` |
| Command palette | Stale requests are cancelled/ignored; failures no longer silently retain unrelated results; keyboard selection is clamped; focus returns to the trigger. | `src/components/cmdk/CommandPalette.tsx` |
| Drafts/search | Draft actions are not nested inside a row link; Keep writing is a real link; search input resets when the URL query changes. A failed search shows an outage, not zero matches, with filter-preserving Retry. | `src/app/(app)/w/[workspace]/(main)/drafts/page.tsx`, `src/app/(app)/w/[workspace]/(main)/search/page.tsx` |
| Space curation | Reopening Edit restores current persisted shelf selections and clears stale errors, rather than retaining cancelled changes. | `src/components/spaces/CurateShelves.tsx` |
| Editor saves | Publish waits for the save queue; failed fields remain queued for retry; title typing is debounced; a failed save has an explicit Retry save action. A 202 response says Sent for review, not Saved, and blocks immediate publishing. Refusing publication during an image upload preserves the pending save timer. | `src/lib/editor-save-queue.ts`, `src/app/(app)/w/[workspace]/(doc)/docs/[id]/edit/DocEditorClient.tsx` |
| Editor AI actions | HTTP/network/empty rewrite failures leave the passage unchanged with the same action available for retry. Citation failures show errors, not no matches; slash citation retry supports Enter and survives deleting the slash command. Current API provider failures return fixed safe messages. | `src/components/editor/v2/SelectionToolbar.tsx`, `src/components/editor/v2/SlashMenu.tsx`, `src/app/api/ai/rewrite/route.ts`, `src/app/api/ai/related/route.ts` |
| Publish permissions/policy | The API requires editor/admin membership, draft author or admin, a still-draft row, and a visible same-workspace destination. Existing disposition rules reject direct canon publication into review-required destinations; records retain their exemption. The sheet explains the limit and cannot change or dismiss mid-request. | `src/app/api/docs/[id]/publish/route.ts`, `src/components/docs/PublishSheet.tsx`, `src/app/(app)/w/[workspace]/(doc)/docs/[id]/edit/page.tsx` |
| History | Restore checks HTTP failures; a queued 202 restoration stays on History and explains that the current doc is unchanged. | `src/app/(app)/w/[workspace]/(doc)/docs/[id]/history/HistoryClient.tsx` |
| Comments/Checks | Comment reload/post/delete operations cannot overlap and undo each other's local state. Request failures and named-reviewer refusals remain visible with retryable controls. | `src/components/docs/DocComments.tsx`, `src/app/(app)/w/[workspace]/(main)/checks/ChecksClient.tsx` |
| Read/mobile actions | Failed Share/Nudge/Confirm actions show failure feedback rather than silently doing nothing. Phone formatting buttons also respond to normal click/keyboard activation. | `src/components/docs/ShareButton.tsx`, `src/components/docs/PhoneReadBar.tsx`, `src/components/docs/TrustLine.tsx`, `src/components/editor/PhoneFormatBar.tsx` |
| Import | Imported page links and report links use the real workspace-qualified route. Changing file or destination invalidates the dry run before Import is enabled again. | `src/app/api/imports/route.ts`, `src/app/(app)/w/[workspace]/settings/import/ImportClient.tsx` |
| Integrations | Unavailable Linear is no longer offered as Available/Active. A repository load failure cannot accidentally save an empty watched-repository selection. | `src/app/(app)/w/[workspace]/settings/integrations/page.tsx`, `src/components/integrations/GitHubRepoPicker.tsx` |
| Settings/People/keys | Failed sign-out, revoke, and member mutations remain visible and retryable. Clipboard success is only reported after a successful write; manual-copy fallbacks exist. One-time key instructions no longer use a truncated credential. | `src/components/layout/AccountMenu.tsx`, `src/components/layout/SettingsSidebar.tsx`, `src/app/(app)/w/[workspace]/settings/members/MembersClient.tsx`, `src/app/(app)/w/[workspace]/settings/keys/KeysClient.tsx` |
| Auth/accessibility | Partial onboarding space creation has a real Retry spaces action. Auth muted text/link distinction and progress semantics are corrected. Landing mock controls are inert; named/current workflow steps and a real Pause/Play button replace misleading affordances. | `src/components/auth/Onboarding.tsx`, `src/app/globals.css`, `src/components/landing/LandingPage.tsx`, `src/components/landing/FlowDemo.tsx` |

No high-confidence regressions were found in these reviewed diffs. The
save/upload debounce issue identified during review was corrected.

## Intentionally unavailable or unsupported

These are not dead buttons that this cleanup claims to implement:

| Capability | Current behavior / follow-up |
| --- | --- |
| Linear connection and enrichment | Unavailable after removal of the old integration dependency. Issue-key extraction can still match PRs to existing docs. The detail page explains this in `src/app/(app)/w/[workspace]/settings/integrations/[provider]/page.tsx`. |
| Password recovery/change | No reset-request or new-password UI exists. `src/app/(auth)/login/page.tsx` supports sign-in only. |
| Public sharing | Share copies the authenticated document URL; it does not grant access or create a public link (`src/components/docs/ShareButton.tsx`). |
| Automatic invitation email | Invitations are stored and their links copied for manual delivery, not emailed (`src/lib/supabase/invitations.ts`, `src/app/(app)/w/[workspace]/settings/members/MembersClient.tsx`). |
| Browser Confluence upload | Browser import takes markdown ZIPs. Confluence exports use `pnpm import`, as explained by `src/app/(app)/w/[workspace]/settings/import/ImportClient.tsx`. |
| Document type/owner editing | Creation patterns choose type; the creator becomes owner. No general metadata-editing UI exists. The false claim that type stays editable on the read surface was removed from `src/components/docs/PublishSheet.tsx`. |
| Initial canon publishing into `review_all` | Direct publishing is disabled in the sheet and rejected by the API, including for admins. Keep the draft or choose an eligible destination. Records retain their existing exemption. Proposal-backed lifecycle publishing needs coordinated backend work (`src/app/api/docs/[id]/publish/route.ts`, `src/lib/merge/disposition.ts`, `src/lib/db/proposals.ts`). |
| Advanced collaboration | Real-time co-editing, per-page permissions, and inline anchored comments remain outside implemented UI, as documented in `docs/roadmap.md`. |

No literal `href="#"` placeholders were found. Landing section anchors resolve.
Search, reading-rail, and phone Ask custom events have matching listeners.
Labeled busy-state buttons and disabled read-view task checkboxes are intentional,
not unfinished features.

## Remaining UI/recovery risks

1. **Failed saves after soft navigation can lose recovery access.** The editor
   flushes its in-memory queue on unmount, but if that final request fails after
   navigation, the retry control is gone and the queued edits have no durable
   recovery surface. The hard-unload warning does not guard soft navigation.
   This is a known data-loss/recovery risk, not authenticated-runtime validated.
   Until recovery is implemented, wait for **Saved** or **Sent for review**
   before leaving, and retry failures while still on the page. Sent for review
   means submitted for review, not applied to the current document.
   Follow up with navigation protection or durable recovery
   (`src/app/(app)/w/[workspace]/(doc)/docs/[id]/edit/DocEditorClient.tsx`,
   `src/lib/editor-save-queue.ts`).
2. **Dialog keyboard focus is inconsistent.** NewSpace has dialog semantics and
   Escape handling but no complete focus trap. Standardize trapping and return
   focus across dialogs as an accessibility follow-up
   (`src/components/layout/NewSpaceButton.tsx`,
   `src/components/spaces/CurateShelves.tsx`).
3. **Low-priority legal-page accessibility follow-up.** Production QA on
   `/terms` still reports five low-contrast metadata/footer nodes and one
   color-only inline Contact link. Increase muted-text contrast and give
   inline links a non-color distinction
   (`src/components/landing/LegalPage.tsx`, `src/app/terms/page.tsx`).
   The clean axe results below apply specifically to landing/login/signup,
   not every public page.

## Backend/security follow-ups, separate from UI cleanup

1. **Publishing is not transactional with its review trail.** The guarded
   status update precedes a review-request comment whose insert result is not
   checked; activity logging is best-effort. A failed trail write can leave
   publication applied without its full review record. Coordinate an atomic
   database/API solution (`src/app/api/docs/[id]/publish/route.ts`).
2. **High priority, legacy AI credentials:** the old workspace AI-key input
   could store a credential unused by runtime AI clients, and settings props
   could expose it to non-admin members. The UI field/save was removed;
   General passes only workspace identity and an AI-configured boolean, and
   workspace API responses strip the legacy key (`src/lib/workspace-settings.ts`).
   This does **not** remediate stored credentials or member-level direct
   database reads. Admin API settings writes also remain accepted. **If the old
   AI-key field was used, rotate that credential and remove the stored legacy
   value.** Database storage/RLS remediation remains a separate follow-up.

## Validation

| Check | Status |
| --- | --- |
| Baseline `pnpm typecheck` | Passed |
| Baseline `pnpm lint` | Passed |
| Baseline `pnpm test` | Passed: 44 files, 576 tests |
| Document owner checks | Passed: 86 focused tests, including 26 publish API, 21 mocked UI-handler, and 6 save-queue tests; scoped ESLint and typecheck |
| Navigation owner checks | Passed: 15 new tests, scoped ESLint, typecheck |
| Initial settings cleanup checks | Passed: 59 focused tests (23 new), scoped ESLint, typecheck, diff check |
| Final `pnpm test` | Passed: 55 files, 707 tests (131 more than baseline) |
| Final `pnpm lint` / diff check | Passed |
| Final `pnpm typecheck` | Passed after the final production build |
| Production `pnpm build` | Passed with isolated dummy loopback Supabase settings |
| Landing post-fix axe | Production QA: zero WCAG2A/AA violations at 390px, 768px, 1100px, and 1440px; gradient illustration contrast checks remain incomplete |
| Passwordless auth axe | Production QA: 23 audits at 390px, 820px, and 1440px; zero violations or incomplete checks |
| Paused landing-step visibility | Production QA passed: selected steps 3/4 heading and stage stay visible while autoplay stays paused; keyboard controls work |
| Post-fix public-page layout | Production QA found no horizontal document overflow at the tested widths |
| Local auth failure recovery | Final fixture QA passed error/retry states and honest callback-failure notices; see passwordless section |
| Authenticated end-to-end / live integrations | Blocked by missing Supabase/test credentials |
| SQL tests | Skipped: no schema changes |
| Preflight | Blocked by missing Supabase configuration |

Landing/legal browser evidence comes from the UI-cleanup production run.
Auth was rechecked after the passwordless changes, as described below. Full
unit/lint/build/typecheck checks passed on the final sources. Mocked tests and
browser fixtures are not authenticated end-to-end tests.

The unit suite intentionally logs a simulated embedding failure in a passing
MCP test. The production build emits the existing middleware-to-proxy
deprecation warning. Neither is evidence of a new runtime regression.

## Passwordless authentication follow-up

**Source review and integrated passwordless QA complete.** No
remaining high-confidence issue was found in the reviewed auth changes.

- Login, signup, and invitation authentication now share an email-first form.
  Login uses `shouldCreateUser: false`; signup/invitation use `true`. Six-digit
  codes use `verifyOtp({ email, token, type: "email" })`. Existing password
  sign-in remains a secondary option; no stored password is changed.
- Safe relative `next` destinations survive send, verification, callback, and
  login/signup links. External, protocol-relative, backslash, and control-character
  destinations are rejected. Callback links support token hashes without the
  original browser's PKCE verifier, plus legacy PKCE/OAuth code exchange.
- Invitation authentication returns to the same token-bearing invitation URL.
  Joining remains an explicit action validated by the existing invitation RPC.
  A review-found signed-in, same-route onboarding spinner was fixed; onboarding
  now re-derives progress instead of waiting for a search-only navigation remount.
- Failed sends/verifications use fixed guidance rather than raw provider errors.
  Pending submissions cannot overlap; successful sends start a 60-second resend
  cooldown. Failed verification/resend keeps code entry retryable.
- Browser QA found formatted code paste was truncated by native `maxLength`
  before digit cleanup, and entering existing-code mode could retain button
  focus so Enter resent instead of verifying. Both are fixed and browser-verified:
  separators are removed before limiting to six digits, and entering code mode
  focuses its input.

Source: `src/components/auth/EmailAuthForm.tsx`, `src/lib/auth/email.ts`,
`src/app/auth/callback/route.ts`, `src/components/auth/Onboarding.tsx`,
`src/app/(auth)/login/page.tsx`, `src/app/(auth)/invite/InviteClient.tsx`.

### Operator prerequisites and tradeoff

Follow `docs/authentication.md`: configure working SMTP/mail delivery, keep
Confirm email enabled, and allow the trusted `/auth/callback` URLs including
their `next` query strings. Both **Confirm signup** and **Magic link** templates
must include the custom token-hash link and `{{ .Token }}` code. Keep OTP length
at six digits; server expiry and rate limits remain authoritative. Supabase's
built-in hosted SMTP service restricts recipients and quotas and is not a
production delivery guarantee. SMTP credentials belong in Supabase, not browser
environment variables.

The setup was checked against Supabase's official passwordless-email,
email-template, SMTP, SSR/PKCE, and rate-limit guides linked from
`docs/authentication.md`. **Enumeration tradeoff:** an unknown login address gets
an explicit create-account/invitation prompt, so account existence is not hidden.

### Passwordless validation and limits

The final integrated suite passed **55 files / 707 tests**, plus production
build, full lint, post-build typecheck, and diff checks. Auth tests cover
send/create-user options,
safe destinations, six-digit entry/verification, invalid/expired/network errors,
no-session refusal, resend cooldown, password fallback, invitation return paths,
the same-route onboarding fix, and paste/focus regressions. These are mocked
unit/handler tests, not delivery or authenticated end-to-end proof.

Production browser QA used a local auth fixture that never issues sessions:

- 23 auth axe audits at 390px/820px/1440px had zero violations or incomplete
  checks, with no horizontal overflow.
- Formatted paste became `123456`; both send-success and existing-code entry
  focused the code input. Enter verified exactly once and did not resend.
- A real cooldown elapsed before resend re-enabled; resend preserved the
  destination and cleared the old code.
- Bogus token-hash and PKCE-code callbacks returned honest sign-in notices
  while retaining `next`.

Real SMTP delivery, spam placement, deployed templates/redirect allowlist,
link/code consumption and expiry, second-browser use, and invitation acceptance
still require live email/Supabase QA. No live mailbox, real authenticated
session, or account was used.
