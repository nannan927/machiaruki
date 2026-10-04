import type { Memo } from "../types/memo";
export const MEMO_FIELDS = "id,user_id,title,body,lat,lng,tags,created_at,updated_at,version";
export const PAGE_SIZE = 50;
export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export type MemoPage = { items: Memo[]; nextCursor: string | null };
export function decodeCursor(value: string | null): { date: string; id: string } | null {
  if (!value) return null;
  if (value.length > 300) throw new Error("ページ指定が正しくありません。");
  try {
    const data = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!isUuid(data.id) || typeof data.date !== "string" || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|\+00:00)$/.test(data.date) || !Number.isFinite(Date.parse(data.date))) throw new Error();
    return data;
  } catch { throw new Error("ページ指定が正しくありません。"); }
}
export function encodeCursor(memo: Memo) { return Buffer.from(JSON.stringify({ date: memo.created_at, id: memo.id })).toString("base64url"); }
export function searchTerms(value: string) {
  if (value.length > 200) throw new Error("検索語は200文字以内で入力してください。");
  return value.normalize("NFKC").toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 10);
}
export function escapeLike(value: string) { return value.replace(/[\\%_]/g, "\\$&"); }
