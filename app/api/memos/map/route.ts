import { NextResponse } from "next/server";
import { authorize, apiError, databaseError } from "@/lib/memo-api";
import { MEMO_FIELDS, searchTerms, escapeLike } from "@/lib/memo-page";
import { parseBounds } from "@/lib/walking-data";
export async function GET(request: Request) {
  const auth = await authorize(request);
  if (auth.response) return auth.response;
  try {
    const params = new URL(request.url).searchParams;
    const bounds = parseBounds(params);
    let query = auth.client.from("memos").select(MEMO_FIELDS).eq("user_id", auth.user.id)
      .gte("lat", bounds.south).lte("lat", bounds.north).gte("lng", bounds.west).lte("lng", bounds.east)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(201);
    for (const term of searchTerms(params.get("q") ?? "")) query = query.ilike("search_text", `%${escapeLike(term)}%`);
    const { data, error } = await query;
    if (error) return databaseError();
    return NextResponse.json({ items: (data ?? []).slice(0, 200), truncated: (data?.length ?? 0) > 200 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return apiError("地図の範囲または検索語を確認してください。", 400); }
}
