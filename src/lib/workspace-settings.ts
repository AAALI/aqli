import type { Workspace } from "@/types/workspace";

/** Legacy workspace keys are unused and must not reach browser responses. */
export function workspaceForClient(workspace: Workspace): Workspace {
  return {
    ...workspace,
    settings: Object.fromEntries(
      Object.entries(workspace.settings ?? {}).filter(([key]) => key !== "openai_key"),
    ),
  };
}
