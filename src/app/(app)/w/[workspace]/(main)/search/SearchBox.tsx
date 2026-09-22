"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconSearch } from "@/components/aqli/icons";

/** The question, in serif at 27px — it is content, the thing being asked. */
export default function SearchBox({ base, initial }: { base: string; initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        router.push(q ? `${base}/search?q=${encodeURIComponent(q)}` : `${base}/search`);
      }}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 0 18px", borderBottom: "1px solid var(--border)" }}
    >
      <span style={{ color: "var(--text-muted)", display: "flex" }}>
        <IconSearch size={20} />
      </span>
      <input
        autoFocus={!initial}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setValue("");
            router.push(`${base}/search`);
          }
        }}
        placeholder="Ask anything your team has written down"
        aria-label="Search"
        style={{ flex: 1, border: 0, outline: "none", background: "none", fontFamily: "var(--font-serif)", fontSize: 27, letterSpacing: "-0.015em", color: "var(--text-primary)" }}
      />
      {value && <span className="kbd">esc to clear</span>}
    </form>
  );
}
