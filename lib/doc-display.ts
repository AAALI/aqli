import type { DocType, DocStatus } from "@/types/doc";

export const TYPE_LABEL: Record<DocType, string> = {
  general: "Doc",
  how_to: "How-to",
  policy: "Policy",
  meeting: "Meeting Notes",
  brief: "Brief",
  decision: "Decision",
  prd: "PRD",
  adr: "ADR",
  runbook: "Runbook",
  fix_note: "Fix Note",
  compliance: "Compliance",
};

export const STATUS_LABEL: Record<DocStatus, string> = {
  draft: "Draft",
  review: "Review",
  approved: "Approved",
  stale: "Stale",
  archived: "Archived",
};

export function typeLabel(type: string): string {
  return TYPE_LABEL[type as DocType] ?? "Doc";
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status as DocStatus] ?? "Draft";
}
