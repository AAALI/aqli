"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
};

export default function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full max-w-md rounded-lg border border-neutral-200 bg-white p-5 shadow-xl",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
