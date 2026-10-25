import { PaperSkeleton } from "@/components/layout/Skeleton";

/**
 * The paper, before the document. Also what Write shows while the server
 * creates the draft and hands over to the editor — the one tap that used to
 * do nothing visible for a whole round trip.
 */
export default function Loading() {
  return <PaperSkeleton />;
}
