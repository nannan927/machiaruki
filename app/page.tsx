"use client";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase";
import { AuthPanel } from "@/components/AuthPanel";
import { WalkingNotebook } from "@/components/WalkingNotebook";
import { GuestTransfer } from "@/components/GuestTransfer";
import { clearDraft } from "@/lib/walking-draft";
import Link from "next/link";


export default function Home() {
  const [hasDraft, setHasDraft] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [importVersion, setImportVersion] = useState(0);
  const [transferCount, setTransferCount] = useState(0);
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
    if (saving || transferring) return;
    if (hasDraft && !window.confirm("この端末の下書きを削除してログアウトしますか？ 保存済みのメモは残ります。")) return;
    setSigningOut(true); setError("");
    try { if (session && hasDraft) await clearDraft(session.user.id); const result = await getBrowserClient()?.auth.signOut({ scope: "local" }); if (result?.error) throw result.error; }
    catch { setError("ログアウトできませんでした。もう一度お試しください。"); }
    finally { setSigningOut(false); }
  }
  return <main className={`container appRoot ${session ? "walkingRoot" : ""}`}>{!session && <header className="hero"><p className="eyebrow">街と一緒に考えるアプリ</p><h1>地図の余白</h1>{!session && <p className="lead">街の余白に、わたしの視点を残す。</p>}</header>}
    {!session && <section className="card guestEntry"><p className="eyebrow">まずは、ひとことから。</p><h2>登録せずに、散歩の記録を残す</h2><p>地図で場所を選んで「書く」。自分の言葉を、すぐに残せます。</p><Link className="entryButton" href="/guest">登録せずに使う →</Link><small>この端末のブラウザーに保存します。あとからGoogleに引き継げます。</small></section>}
    {error && <p className="error" role="alert">{error}</p>}
    {!ready ? <p role="status">読み込み中…</p> : session ? <WalkingNotebook key={session.user.id} revision={importVersion} owner={session.user.id} onUnsavedChange={setHasDraft} onSavingChange={setSaving} transferCount={transferCount} transferring={transferring} accountContent={<>
      <div className="settingsInset"><strong>アカウントに保存</strong><p>{session.user.email}</p><p>同じアカウントでログインすると、スマホでもパソコンでも読み返せます。</p></div>
      <GuestTransfer key={`transfer:${session.user.id}`} disabled={saving || hasDraft} onBusy={setTransferring} onAvailable={setTransferCount} owner={session.user.id} email={session.user.email ?? ""} onComplete={() => { setImportVersion(n => n + 1); setTransferCount(0); }} />
      <button type="button" disabled={signingOut || saving || transferring} onClick={() => void signOut()}>{signingOut ? "ログアウト中…" : "ログアウト"}</button>
    </>} /> : <AuthPanel />}
    {!session && <p className="guestFooter"><Link href="/help">使い方・よくある質問</Link> · <Link href="/demo">以前のデモと記録を開く</Link></p>}
  </main>;
}
