import Link from "next/link";
import SignOutButton from "./SignOutButton";

export default function TopBar({
  workspaceSlug,
  userEmail,
}: {
  workspaceSlug: string;
  userEmail?: string;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 px-4">
      <Link href={`/w/${workspaceSlug}`} className="text-sm font-semibold">
        Aqli
      </Link>
      <div className="flex items-center gap-3 text-sm text-neutral-500">
        {userEmail && <span className="hidden sm:inline">{userEmail}</span>}
        <SignOutButton />
      </div>
    </header>
  );
}
