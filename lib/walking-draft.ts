import type { CreateMemoInput, Memo } from "@/types/memo";
import type { Point } from "./walking-data";
export type PendingWrite = { method: "POST" | "PATCH" | "DELETE"; id: string; version: number; input?: CreateMemoInput };
export type WalkingDraft = {
  schema: 1; owner: string; title: string; body: string; tags: string; point: Point | null;
  memoId?: string; baseVersion: number; pending?: PendingWrite; updatedAt: number;
};
export function emptyDraft(owner: string): WalkingDraft { return { schema: 1, owner, title: "", body: "", tags: "", point: null, baseVersion: 1, updatedAt: Date.now() }; }
export function editDraft(owner: string, memo: Memo): WalkingDraft { return { ...emptyDraft(owner), title: memo.title ?? "", body: memo.body, tags: memo.tags.join(", "), point: { lat: memo.lat, lng: memo.lng }, memoId: memo.id, baseVersion: memo.version ?? 1 }; }
export function hasDraft(draft: WalkingDraft) { return !!(draft.title || draft.body || draft.tags || draft.pending || draft.memoId); }
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("machinote-private-drafts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts", { keyPath: "owner" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("端末に下書きを保存できません。"));
    request.onblocked = () => reject(new Error("別のタブを閉じてから再度お試しください。"));
  });
}
async function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await database();
  try { return await new Promise<T>((resolve, reject) => {
    const tx = db.transaction("drafts", mode); const request = run(tx.objectStore("drafts"));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(new Error("端末の下書きを読み書きできません。空き容量や保存の許可を確認してください。"));
  }); } finally { db.close(); }
}
// Per-tab writes execute in order, including clearing a successfully saved draft.
let writes: Promise<unknown> = Promise.resolve();
export function storeDraft(draft: WalkingDraft) {
  const snapshot = structuredClone(draft);
  const result = writes.catch(() => {}).then(() => transact("readwrite", store => store.put(snapshot)));
  writes = result; return result;
}
export function clearDraft(owner: string) {
  const result = writes.catch(() => {}).then(() => transact("readwrite", store => store.delete(owner)));
  writes = result; return result;
}
export async function loadDraft(owner: string): Promise<WalkingDraft | null> {
  const value = await transact("readonly", store => store.get(owner));
  if (value == null) return null;
  if (value.schema !== 1 || value.owner !== owner || typeof value.body !== "string" || typeof value.title !== "string" || typeof value.tags !== "string") throw new Error("下書きの形式を読み込めません。データは変更していません。別のブラウザーで記録するか、管理者にご相談ください。");
  return value;
}
