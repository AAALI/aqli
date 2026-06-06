import Link from "next/link";
import { notFound } from "next/navigation";
import { getDoc, getDocVersions } from "@/lib/supabase/docs";
import DocStatusBadge from "@/components/docs/DocStatusBadge";
import DownloadMarkdownButton from "@/components/docs/DownloadMarkdownButton";
import VersionHistory from "@/components/docs/VersionHistory";
import AqliEditor from "@/components/editor/AqliEditor";
import Button from "@/components/ui/Button";
import { formatRelative } from "@/lib/utils";

export default async function DocViewPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace: wsSlug, id } = await params;
  const doc = await getDoc(id).catch(() => null);
  if (!doc) notFound();
  const versions = await getDocVersions(id);

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">{doc.title}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <DownloadMarkdownButton doc={doc} />
          <Link href={`/w/${wsSlug}/docs/${doc.id}/edit`}>
            <Button>Edit</Button>
          </Link>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        <DocStatusBadge status={doc.status} />
        <span className="capitalize">{doc.type.replace("_", " ")}</span>
        {doc.space && (
          <span>
            · {doc.space.icon} {doc.space.name}
          </span>
        )}
        <span>· Updated {formatRelative(doc.updated_at)}</span>
        {doc.frontmatter?.linked_project_url && (
          <a
            href={doc.frontmatter.linked_project_url}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline"
          >
            · Linked project
          </a>
        )}
      </div>

      {(doc.frontmatter?.tags?.length ?? 0) > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {doc.frontmatter.tags.map((t) => (
            <span
              key={t}
              className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-neutral-200">
        <AqliEditor initialContent={doc.body_json} editable={false} />
      </div>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">
          Version history
        </h2>
        <VersionHistory versions={versions} />
      </section>
    </div>
  );
}
