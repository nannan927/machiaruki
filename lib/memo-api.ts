import { NextResponse } from "next/server";
import { getServerClient } from "./supabase";
import { parseMemo } from "./memo-validation";
export function apiError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } });
}
export async function authorize(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token || token.length > 8192) return { response: apiError("ログインしてください。", 401) };
  const client = getServerClient(token);
  if (!client) return { response: apiError("保存先が設定されていません。", 503) };
  try {
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) return { response: apiError(error && error.status && error.status >= 500 ? "認証サービスに接続できません。" : "ログインの有効期限が切れました。再度ログインしてください。", error?.status && error.status >= 500 ? 503 : 401) };
    return { client, user };
  } catch { return { response: apiError("認証サービスに接続できません。", 503) }; }
}
const MAX_BODY = 16384;
export async function readMemo(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_BODY) return { response: apiError("入力サイズが大きすぎます。", 413) };
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return { response: apiError("JSON形式で送信してください。", 415) };
  const reader = request.body?.getReader();
  if (!reader) return { response: apiError("本文がありません。", 400) };
  try {
    let bytes = 0; let text = "";
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY) { await reader.cancel(); return { response: apiError("入力サイズが大きすぎます。", 413) }; }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { input: parseMemo(JSON.parse(text)) };
  } catch (error) { return { response: apiError(error instanceof SyntaxError ? "JSONの形式が正しくありません。" : (error as Error).message, 400) }; }
  finally { reader.releaseLock(); }
}
export function readVersion(request: Request) {
  const raw = request.headers.get("if-match");
  if (!raw || !/^(?:[1-9]\d{0,8}|"[1-9]\d{0,8}")$/.test(raw)) return null;
  return Number(raw.replaceAll('"', ""));
}
export function databaseError() { return apiError("メモを読み書きできませんでした。時間を置いてお試しください。", 503); }
