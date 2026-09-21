"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconSearch, IconPlus } from "@/components/aqli/icons";

/**
 * The phone's bottom tabs (v3 §2, §4): Home, Search, and Write between them.
 * Three and no more — the phone reads and captures. Checks, settings and
 * space browsing are desktop jobs. Hidden by CSS above 767px.
 */
export default function PhoneTabs({ base, writeHref }: { base: string; writeHref: string }) {
  const pathname = usePathname();
  return (
    <nav className="ptabs" aria-label="Main">
      <Link href={base} className={`ptab${pathname === base ? " is-on" : ""}`}>
        <IconHome size={20} />
        Home
      </Link>
      <Link href={writeHref} className="ptab" aria-label="Write">
        <span className="ptab-write"><IconPlus size={18} /></span>
      </Link>
      <Link href={`${base}/search`} className={`ptab${pathname.startsWith(`${base}/search`) ? " is-on" : ""}`}>
        <IconSearch size={20} />
        Search
      </Link>
    </nav>
  );
}
