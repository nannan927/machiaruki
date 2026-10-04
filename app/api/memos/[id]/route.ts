import { NextResponse } from "next/server";
import { authorize, apiError, databaseError, readMemo, readVersion } from "@/lib/memo-api";
import { isUuid, MEMO_FIELDS } from "@/lib/memo-page";
type Context = { params: Promise<{ id: string }> };
const conflict = () => apiError("このメモは別の画面で更新または削除されました。入力内容を控え、一覧を再読み込みしてください。", 409);
export async function PATCH(request: Request, context: Context) {
  const auth = await authorize(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  if (!isUuid(id)) return apiError("メモが見つかりません。", 404);
  const version = readVersion(request);
  if (version === null) return apiError("更新前のバージョンが必要です。", 428);
  const parsed = await readMemo(request);
  if (parsed.response) return parsed.response;
  const { data, error } = await auth.client.from("memos").update({ ...parsed.input, title: parsed.input.title || null }).eq("id", id).eq("user_id", auth.user.id).eq("version", version).select(MEMO_FIELDS).maybeSingle();
  if (error) return databaseError();
  return data ? NextResponse.json(data) : conflict();
}
export async function DELETE(request: Request, context: Context) {
  const auth = await authorize(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  if (!isUuid(id)) return apiError("メモが見つかりません。", 404);
  const version = readVersion(request);
  if (version === null) return apiError("削除前のバージョンが必要です。", 428);
  const { data, error } = await auth.client.from("memos").delete().eq("id", id).eq("user_id", auth.user.id).eq("version", version).select("id").maybeSingle();
  if (error) return databaseError();
  return data ? new Response(null, { status: 204 }) : conflict();
}
