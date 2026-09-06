import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

export default function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-800 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500",
        className,
      )}
      {...props}
    />
  );
}
