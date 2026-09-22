/**
 * The two documents every adopting company writes anyway.
 *
 * "How do we run this thing?" and "where does it live?" get written by hand at
 * every installation, badly, late, and usually after the question has already
 * been asked in chat three times. Shipping them as templates is cheaper for us
 * than the support thread is for them — and it means a new workspace opens with
 * a real document in it rather than an empty state and a blinking cursor
 * (docs/adoption.md F-5).
 *
 * They are seeded published and confirmed — Current — because they describe
 * how the workspace works rather than proposing anything; their cadence will
 * bring them back round for a look when they start ageing. Both are written to be edited: the runbook in particular is
 * mostly blanks, because the answers are per-installation and a template that
 * invents them is worse than one that asks.
 */
export type StarterDoc = { title: string; bodyMd: string };

export function starterDocs(workspaceName: string): StarterDoc[] {
  return [
    {
      title: `How we run ${workspaceName} docs`,
      bodyMd: `This page explains how this workspace works. Edit it — it was seeded when the
workspace was created, and every team ends up wanting different answers.

## What goes where

Spaces are the top-level division. Inside one, pages nest: a page with
sub-pages is a section. Prefer putting a page under the section it belongs to
over inventing a new space for it.

## Is this still true?

Every published page carries one of three states, shown as a dot wherever the
page appears:

| State | What it means |
|---|---|
| Current | someone confirmed it recently |
| Ageing | nobody has confirmed it in a while |
| Unverified | never confirmed, or changed since it last was |

Publishing a page with nobody asked to check it counts as your confirmation.
Name people in the publish sheet and it waits on them instead — they find it in
Checks. When a page starts ageing, open it and confirm it's still true, even if
nothing changed.

## Who checks what

Each space decides whose changes need a person to confirm them, in Settings →
Spaces:

| Setting | Who publishes directly | Use it for |
|---|---|---|
| Everyone | anyone, including agents | scratch spaces |
| Agents checked | people publish; agent changes wait in Checks | most spaces |
| Everything checked | nobody — every change waits in Checks | policy, compliance |

A space can also name its **checkers**, and then only they can confirm there.

## Private spaces

A space set to *Members only* is readable by its members and nobody else — not
in search and not through any agent, which inherits the space membership of
whoever owns its key. Being a workspace admin is not membership.

## Agents

Agents read published pages and write drafts back; a person confirms each one
in Checks before it becomes part of the workspace. Keys live in Settings → AI
access, one per agent, so each one's work can be told apart.

## What we have decided

_Record the calls that are easy to forget: which spaces are private and why,
who checks policy changes, what belongs in chat rather than here._
`,
    },
    {
      title: "Running this instance",
      bodyMd: `The operational notes for this Aqli installation. Fill in the blanks — they
are deliberately blank, because the answers are different for every
installation and a template that guesses at them is worse than one that asks.

## Where it runs

- **App:** _where it is deployed, and who can deploy it_
- **Database:** _the Supabase project, and which region it is in_
- **Region and residency:** _does the region match what your policies require?_

## Checking it

\`\`\`bash
pnpm preflight
\`\`\`

Or Settings → Health, for an admin with no shell. It reports unapplied
migrations, tables serving rows without row-level security, whether markdown is
canonical, whether published documents are actually embedded, and whether email
confirmation is still off. Run it after every deploy.

## Getting the content out

\`\`\`bash
pnpm export --workspace <slug>
\`\`\`

Or Settings → Import & export. Markdown and images, laid out as folders, and it
imports back — which is the point. Take one before any migration, and keep one
somewhere that is not this instance.

## Backups

- **What Supabase keeps for us:** _plan, retention, and where to find it_
- **Restore tested on:** _date — restoring into a scratch project counts, and
  an untested backup is a hope_

## Who to call

_Name a person for the app, a person for the database, and what "urgent" means._
`,
    },
  ];
}
