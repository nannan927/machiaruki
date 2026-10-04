import type { CreateMemoInput } from "../types/memo";

export function parseMemo(value: unknown): CreateMemoInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("メモの形式が正しくありません。");
  const input = value as Record<string, unknown>;
  if ([input.title, input.body, ...(Array.isArray(input.tags) ? input.tags : [])].some(item => typeof item === "string" && item.includes("\0"))) throw new Error("使用できない文字が含まれています。");
  if (typeof input.body !== "string" || !input.body.trim() || input.body.trim().length > 2000) throw new Error("本文は1〜2000文字で入力してください。");
  if (input.title !== undefined && (typeof input.title !== "string" || input.title.trim().length > 120)) throw new Error("タイトルは120文字以内で入力してください。");
  if (typeof input.lat !== "number" || !Number.isFinite(input.lat) || Math.abs(input.lat) > 90) throw new Error("緯度が正しくありません。");
  if (typeof input.lng !== "number" || !Number.isFinite(input.lng) || Math.abs(input.lng) > 180) throw new Error("経度が正しくありません。");
  if (input.tags !== undefined && (!Array.isArray(input.tags) || input.tags.length > 10 || input.tags.some(tag => typeof tag !== "string" || tag.trim().length > 40))) throw new Error("タグは10個まで、各40文字以内で入力してください。");
  return { title: (input.title as string | undefined)?.trim() || undefined, body: input.body.trim(), lat: input.lat, lng: input.lng, tags: [...new Set(((input.tags ?? []) as string[]).map(tag => tag.trim()).filter(Boolean))] };
}
