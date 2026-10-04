"use client";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase";
import { AuthPanel } from "@/components/AuthPanel";
import { Notebook } from "@/components/Notebook";
import Link from "next/link";


export default function Home() {
  const [hasDraft, setHasDraft] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    const client = getBrowserClient();
    if (!client) { queueMicrotask(() => setReady(true)); return; }
    const timer = window.setTimeout(() => { setError("認証情報を読み込めませんでした。接続を確認してページを再読み込みしてください。"); setReady(true); }, 15000);
    const { data: { subscription } } = client.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") { window.location.replace("/auth/reset"); return; }
      setSession(next); setReady(true); setError(""); window.clearTimeout(timer);
    });
    return () => { window.clearTimeout(timer); subscription.unsubscribe(); };
  }, []);
  async function signOut() {
    if (hasDraft && !window.confirm("未保存の内容を破棄してログアウトしますか？")) return;
    setSigningOut(true); setError("");
    try { const result = await getBrowserClient()?.auth.signOut({ scope: "local" }); if (result?.error) throw result.error; }
    catch { setError("ログアウトできませんでした。もう一度お試しください。"); }
    finally { setSigningOut(false); }
  }
  return <main className="container appRoot"><header className="hero"><p className="eyebrow">街と一緒に考えるアプリ</p><h1>地図の余白</h1><p className="lead">街の余白に、わたしの視点を残す。</p></header>
    <p className="demoEntry"><Link href="/demo" onClick={event => { if (hasDraft && !window.confirm("未保存の内容を破棄してデモへ移動しますか？")) event.preventDefault(); }}>ログインせずにデモを試す →</Link></p>
    {error && <p className="error" role="alert">{error}</p>}
    {!ready ? <p role="status">読み込み中…</p> : session ? <><div className="accountBar"><span>{session.user.email}</span><button type="button" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? "ログアウト中…" : "ログアウト"}</button></div><Notebook key={session.user.id} onUnsavedChange={setHasDraft} /></> : <AuthPanel />}
  </main>;
}
