import type { Memo } from "@/types/memo";
import { parseMemo } from "./memo-validation";
import { filterMemos } from "./memo-search";
import { MemoRequestError } from "./client-api";
import { parseBounds } from "./walking-data";
import { isUuid } from "./memo-page";

export const GUEST_OWNER = "browser-guest";
type Receipt = { key: string; id: string; done: boolean };
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open("machinote-guest", 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore("memos", { keyPath: "id" });
      open.result.createObjectStore("imports", { keyPath: "key" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = open.onblocked = () => reject(new Error("このブラウザーの保存領域を開けません。保存の許可・空き容量を確認してください。"));
  });
}
export function validateGuest(value: unknown): Memo {
  const memo = value as Memo;
  if (!memo || !isUuid(memo.id) || memo.user_id !== GUEST_OWNER || !Number.isInteger(memo.version) || memo.version! < 1 || (memo.title !== null && typeof memo.title !== "string") || !Array.isArray(memo.tags) || typeof memo.created_at !== "string" || typeof memo.updated_at !== "string" || !Number.isFinite(Date.parse(memo.created_at)) || !Number.isFinite(Date.parse(memo.updated_at))) throw new Error("端末の記録を読み込めません。元のデータは変更していません。");
  parseMemo({ ...memo, title: memo.title ?? undefined });
  return memo;
}
async function readStore<T>(name: string): Promise<T[]> {
  const db = await database();
  try { return await new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(name); const req = tx.objectStore(name).getAll();
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = tx.onabort = () => reject(new Error("端末の記録を読み込めません。"));
  }); } finally { db.close(); }
}
export async function guestRecords() { return (await readStore<Memo>("memos")).map(validateGuest); }
export async function importLegacyDemo() {
  const raw = localStorage.getItem("machinote-demo-v1");
  if (!raw) return 0;
  const source = JSON.parse(raw);
  if (!Array.isArray(source)) throw new Error("以前のデモを読み込めません。元の記録は変更していません。");
  const records = source.filter(m => !String(m.id).startsWith("sample-"));
  const existing = new Set((await guestRecords()).map(m => m.id));
  let count = 0;
  for (const memo of records) {
    if (existing.has(memo.id)) continue;
    const input = parseMemo({ ...memo, title: memo.title ?? undefined });
    const date = new Date(memo.created_at).toISOString();
    await guestRequest("", { method: "POST", headers: { "Idempotency-Key": memo.id, "X-Memo-Created-At": date }, body: JSON.stringify(input) });
    count++;
  }
  return count;
}
export async function importReceipts() { return readStore<Receipt>("imports"); }
export function receiptKey(owner: string, memo: Memo) { return `${owner}:${memo.id}:${memo.version}`; }
export async function saveReceipt(receipt: Receipt) {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("imports", "readwrite"); tx.objectStore("imports").put(receipt);
    tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(new Error("引き継ぎ状況を端末に保存できません。記録は残っています。"));
  }); } finally { db.close(); }
}

// Mutations read and write in one transaction so failures never erase the previous copy.
export async function guestRequest(path = "", init: RequestInit = {}) {
  const url = new URL(path || "/", "https://guest.invalid");
  const method = init.method ?? "GET";
  if (method === "GET") {
    const records = await guestRecords();
    if (url.pathname !== "/" && url.pathname !== "/map") {
      const memo = records.find(m => m.id === url.pathname.slice(1));
      if (!memo) throw new MemoRequestError("このブラウザーに記録がありません。", 404);
      return memo;
    }
    let items = filterMemos(records, url.searchParams.get("q") ?? "").sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    if (url.pathname === "/map") {
      const b = parseBounds(url.searchParams);
      items = items.filter(m => m.lat >= b.south && m.lat <= b.north && m.lng >= b.west && m.lng <= b.east);
      return { items: items.slice(0, 200), truncated: items.length > 200 };
    }
    return { items, nextCursor: null };
  }
  const db = await database();
  try { return await new Promise<Memo | null>((resolve, reject) => {
    const tx = db.transaction("memos", "readwrite"); const store = tx.objectStore("memos");
    let result: Memo | null = null; let failure: Error | undefined;
    const headers = new Headers(init.headers);
    const id = method === "POST" ? headers.get("idempotency-key") ?? "" : url.pathname.slice(1);
    tx.oncomplete = () => resolve(result);
    tx.onerror = tx.onabort = () => reject(failure ?? new Error("端末に保存できません。空き容量や保存の許可を確認してください。"));
    if (method === "DELETE" && url.pathname === "/all") { store.clear(); return; }
    const read = store.get(id);
    read.onsuccess = () => {
      try {
        if (!isUuid(id)) throw new Error("記録のIDが正しくありません。");
        const previous = read.result ? validateGuest(read.result) : null;
        if (method !== "POST" && (!previous || previous.version !== Number(headers.get("if-match")))) throw new MemoRequestError("別の変更が見つかりました。記録を再読み込みしてください。", 409);
        if (method === "DELETE") { store.delete(id); return; }
        const input = parseMemo(JSON.parse(String(init.body)));
        if (method === "POST" && previous) {
          if (JSON.stringify(parseMemo({ ...previous, title: previous.title ?? undefined })) !== JSON.stringify(input)) throw new MemoRequestError("同じ保存操作に別の記録があります。", 409);
          result = previous; return;
        }
        const now = new Date().toISOString();
        const originalDate = headers.get("x-memo-created-at");
        if (originalDate && !Number.isFinite(Date.parse(originalDate))) throw new Error("元の記録の日時が正しくありません。");
        result = { ...input, title: input.title ?? null, tags: input.tags ?? [], id, user_id: GUEST_OWNER, version: (previous?.version ?? 0) + 1, created_at: previous?.created_at ?? originalDate ?? now, updated_at: now };
        store.put(result);
      } catch (error) { failure = error instanceof DOMException ? new Error("端末に保存できません。空き容量や保存の許可を確認してください。") : error as Error; tx.abort(); }
    };
  }); } finally { db.close(); }
}
