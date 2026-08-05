export { scoped, withWorkspace, ScopedClient } from "./scoped";
export type { Actor, Scope } from "./scoped";
export { unscoped } from "./client";
export {
  submitProposal,
  mergeProposal,
  rejectProposal,
  MergeError,
} from "./proposals";
export type {
  SubmitInput,
  SubmitResult,
  MergeErrorCode,
  RpcClient,
} from "./proposals";
