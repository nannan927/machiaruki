"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase";
export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const client = getBrowserClient();
    if (!client) { queueMicrotask(() => setReady(true)); return; }
    const timer = window.setTimeout(() => { setReady(true); }, 15000);
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => { setAuthorized(!!session); setReady(true); window.clearTimeout(timer); });
    return () => { window.clearTimeout(timer); subscription.unsubscribe(); };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!authorized || busy) return;
    if (password !== confirmation) { setMessage("パスワードが一致しません。"); return; }
    setBusy(true); setMessage("");
    try {
      const result = await getBrowserClient()?.auth.updateUser({ password });
      if (!result || result.error) { setMessage("更新できませんでした。別のパスワードを試すか、再設定メールを送り直してください。"); return; }
      setPassword(""); setConfirmation(""); setDone(true);
    } catch { setMessage("通信できませんでした。もう一度お試しください。"); }
    finally { setBusy(false); }
  }
  return <main className="container appRoot"><section className="card authCard"><h1>パスワード再設定</h1>
    {!ready ? <p role="status">確認中…</p> : done ? <p role="status">パスワードを更新しました。</p> : !authorized ? <p role="alert">リンクが無効か期限切れです。ログイン画面から再設定メールを送り直してください。</p> : <form className="form" onSubmit={submit}><fieldset disabled={busy}>
      <label>新しいパスワード<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label>新しいパスワードの確認<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
      <button className="primaryBtn">{busy ? "更新中…" : "パスワードを更新"}</button><p role="status">{message}</p>
    </fieldset></form>}
    <Link href="/">ノートへ戻る</Link>
  </section></main>;
}
