"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import NewSpaceButton from "./NewSpaceButton";
import type { Space } from "@/types/space";

type Props = {
  workspaceSlug: string;
  workspaceId: string;
  workspaceName: string;
  spaces: Space[];
};

export default function Sidebar({
  workspaceSlug,
  workspaceId,
  workspaceName,
  spaces,
}: Props) {
  const pathname = usePathname();
  const base = `/w/${workspaceSlug}`;

  const link = (href: string, active: boolean) =>
    cn(
      "flex items-center gap-2 rounded px-3 py-1.5 text-sm",
      active
        ? "bg-neutral-200 text-neutral-900"
        : "text-neutral-600 hover:bg-neutral-100",
    );

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50">
      <div className="border-b border-neutral-200 px-4 py-4">
        <span className="text-sm font-semibold text-neutral-800">
          {workspaceName}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <Link href={base} className={cn(link(base, pathname === base), "mb-1")}>
          🏠 Home
        </Link>
        <Link
          href={`${base}/search`}
          className={cn(link("", pathname.includes("/search")), "mb-3")}
        >
          🔍 Search
        </Link>

        <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-neutral-400">
          Spaces
        </p>
        {spaces.map((space) => (
          <Link
            key={space.id}
            href={`${base}/s/${space.slug}`}
            className={link("", pathname.includes(`/s/${space.slug}`))}
          >
            {space.icon} {space.name}
          </Link>
        ))}
        <div className="mt-1">
          <NewSpaceButton workspaceId={workspaceId} />
        </div>
      </nav>
    </aside>
  );
}
