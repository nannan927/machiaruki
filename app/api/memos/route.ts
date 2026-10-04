import { NextResponse } from "next/server";
import { authorize, apiError, databaseError, readMemo } from "@/lib/memo-api";
import { decodeCursor, encodeCursor, escapeLike, isUuid, MEMO_FIELDS, PAGE_SIZE, searchTerms } from "@/lib/memo-page";
import type { Memo } from "@/types/memo";

export async function GET(request: Request) {
  const auth = await authorize(request);
  if (auth.response) return auth.response;
  try {
    const url = new URL(request.url);
    const cursor = decodeCursor(url.searchParams.get("cursor"));
    const terms = searchTerms(url.searchParams.get("q") ?? "");
    let query = auth.client.from("memos").select(MEMO_FIELDS).eq("user_id", auth.user.id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(PAGE_SIZE + 1);
    for (const term of terms) query = query.ilike("search_text", `%${escapeLike(term)}%`);
    if (cursor) query = query.or(`created_at.lt.${cursor.date},and(created_at.eq.${cursor.date},id.lt.${cursor.id})`);
    const { data, error } = await query;
    if (error) return databaseError();
    const rows = (data ?? []) as Memo[];
    return NextResponse.json({ items: rows.slice(0, PAGE_SIZE), nextCursor: rows.length > PAGE_SIZE ? encodeCursor(rows[PAGE_SIZE - 1]) : null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error instanceof Error ? error.message : "一覧を取得できませんでした。", 400); }
}
export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth.response) return auth.response;
  const id = request.headers.get("idempotency-key") ?? "";
  if (!isUuid(id)) return apiError("保存操作のIDが正しくありません。", 400);
  const parsed = await readMemo(request);
  if (parsed.response) return parsed.response;
  const input = { ...parsed.input, title: parsed.input.title || null };
  const { data, error } = await auth.client.from("memos").insert({ ...input, id, user_id: auth.user.id }).select(MEMO_FIELDS).single();
  if (error?.code === "23505") {
    const { data: existing, error: lookupError } = await auth.client.from("memos").select(MEMO_FIELDS).eq("id", id).eq("user_id", auth.user.id).maybeSingle();
    if (lookupError) return databaseError();
    if (existing && existing.title === input.title && existing.body === input.body && existing.lat === input.lat && existing.lng === input.lng && JSON.stringify(existing.tags) === JSON.stringify(input.tags)) return NextResponse.json(existing);
    return apiError("同じ保存操作が既に処理されています。一覧を確認してください。", 409);
  }
  if (error) return databaseError();
  return NextResponse.json(data, { status: 201 });
}
