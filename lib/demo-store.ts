import type { Memo } from "@/types/memo";
import { parseMemo } from "./memo-validation";
const storageKey = "machinote-demo-v1";
function examples(): Memo[] {
  return [
    { title: "川沿いの小さなベンチ", body: "水面に光が揺れていた。次は本を一冊持ってこよう。", lat: 36.7422, lng: 137.0173, tags: ["水辺", "ひと休み"] },
    { title: "路地の喫茶店", body: "角を曲がると、コーヒーの香り。窓際の席から行き交う人を眺めたい。", lat: 36.7405, lng: 137.0137, tags: ["喫茶店", "路地"] },
    { title: "木漏れ日の散歩道", body: "葉っぱの影が足元に模様を作っている。少し遠回りしてよかった。", lat: 36.7430, lng: 137.0128, tags: ["緑", "発見"] },
  ].map((item, index) => ({ ...item, id: `sample-${index}`, user_id: "demo", created_at: `2026-10-0${3 - index}T09:00:00Z`, updated_at: `2026-10-0${3 - index}T09:00:00Z` }));
}
function read(): Memo[] {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) { const initial = examples(); localStorage.setItem(storageKey, JSON.stringify(initial)); return initial; }
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("デモの保存データを読み込めませんでした。");
  return data;
}
export async function demoRequest(path = "", init: RequestInit = {}) {
  try {
    const memos = read();
    const method = init.method ?? "GET";
    if (method === "GET") return memos;
    const id = path.replace(/^\//, "");
    if (method === "DELETE") {
      localStorage.setItem(storageKey, JSON.stringify(memos.filter(memo => memo.id !== id)));
      return null;
    }
    const input = parseMemo(JSON.parse(String(init.body)));
    const existing = memos.find(memo => memo.id === id);
    if (method === "PATCH" && !existing) throw new Error("メモが見つかりません。");
    const now = new Date().toISOString();
    const memo: Memo = { version: (existing?.version ?? 0) + 1, ...input, title: input.title ?? null, tags: input.tags ?? [], id: existing?.id ?? crypto.randomUUID(), user_id: "demo", created_at: existing?.created_at ?? now, updated_at: now };
    localStorage.setItem(storageKey, JSON.stringify([memo, ...memos.filter(item => item.id !== memo.id)]));
    return memo;
  } catch (error) {
    if (error instanceof DOMException) throw new Error("ブラウザーに保存できません。ストレージの許可・空き容量を確認してください。");
    throw error;
  }
}
