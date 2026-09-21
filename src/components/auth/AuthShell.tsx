import type { ReactNode } from "react";
import Link from "next/link";
import { AqliMark } from "@/components/aqli/AqliMark";

/**
 * The shell every auth screen shares with onboarding (v3 §2 "Onboarding"):
 * the wordmark top-left and one 466px card, optically raised. Sign-in and
 * invite are not drawn in the frames, so they take the nearest thing that is.
 */
export function AuthStage({ children }: { children: ReactNode }) {
  return (
    <div className="ob">
      <div className="ob-t">
        <Link href="/" className="wm" aria-label="Aqli">
          <AqliMark size={20} />
          <span>aqli</span>
        </Link>
      </div>
      <div className="ob-mid">
        <div className="ob-card">{children}</div>
      </div>
    </div>
  );
}
