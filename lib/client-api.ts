import { getBrowserClient } from "./supabase";
export class MemoRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function memoRequest(path = "", init: RequestInit = {}) {
  const client = getBrowserClient();
  const session = client ? (await client.auth.getSession()).data.session : null;
  if (!session) throw new MemoRequestError("ログインしてください。", 401);
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${session.access_token}`);
  const timeout = AbortSignal.timeout(15000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  let response: Response;
  try { response = await fetch(`/api/memos${path}`, { ...init, signal, cache: "no-store", headers }); }
  catch (error) {
    if (init.signal?.aborted) throw error;
    throw new MemoRequestError("通信を確認できませんでした。入力は残っています。同じ内容で再試行できます。", 0);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new MemoRequestError(data.error || "通信に失敗しました。もう一度お試しください。", response.status);
  }
  return response.status === 204 ? null : response.json();
}
