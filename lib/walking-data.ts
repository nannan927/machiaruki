import type { Memo } from "@/types/memo";
export type Point = { lat: number; lng: number };
export type MapBounds = { west: number; south: number; east: number; north: number };
export function parseBounds(params: URLSearchParams): MapBounds {
  const values = ["west", "south", "east", "north"].map(key => {
    const raw = params.get(key);
    if (!raw?.trim() || !Number.isFinite(Number(raw))) throw new Error("地図の範囲が正しくありません。");
    return Number(raw);
  });
  const [west, south, east, north] = values;
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) throw new Error("地図の範囲が正しくありません。");
  return { west, south, east, north };
}
export function memoLabel(memo: Pick<Memo, "title" | "body">) { return memo.title || memo.body.replace(/\s+/g, " ").slice(0, 40); }
export function dayGroups(memos: Memo[]) {
  const groups = new Map<string, Memo[]>();
  for (const memo of [...memos].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const date = new Date(memo.created_at).toLocaleDateString("ja-JP");
    groups.set(date, [...(groups.get(date) ?? []), memo]);
  }
  return [...groups].reverse();
}
