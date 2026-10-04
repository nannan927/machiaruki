import { MemoRequestError, memoRequest } from "./client-api";
import type { PendingWrite } from "./walking-draft";
import type { Memo } from "@/types/memo";
export function samePayload(memo: Memo, operation: PendingWrite) {
  const input = operation.input;
  return !!input && (memo.title ?? "") === (input.title ?? "") && memo.body === input.body && memo.lat === input.lat && memo.lng === input.lng && JSON.stringify(memo.tags) === JSON.stringify(input.tags ?? []);
}
// Reconcile an uncertain response before retrying. A conflict never overwrites the remote copy.
export async function performWrite(operation: PendingWrite, retry: boolean, request = memoRequest): Promise<Memo | null> {
  if (retry) {
    let remote: Memo | null;
    try { remote = await request(`/${operation.id}`); }
    catch (error) { if (error instanceof MemoRequestError && error.status === 404) remote = null; else throw error; }
    if (operation.method === "DELETE" && !remote) return null;
    if (remote && operation.method !== "DELETE" && samePayload(remote, operation)) return remote;
    if (operation.method === "POST" ? !!remote : !remote || (remote.version ?? 1) !== operation.version) throw new MemoRequestError("別の変更が見つかりました。書きかけは残っています。保存済みの記録を確認してください。", 409);
  }
  return request(operation.method === "POST" ? "" : `/${operation.id}`, {
    method: operation.method, ...(operation.input ? { body: JSON.stringify(operation.input) } : {}),
    headers: operation.method === "POST" ? { "Idempotency-Key": operation.id } : { "If-Match": String(operation.version) },
  });
}
