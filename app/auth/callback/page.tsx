"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase";

export default function AuthCallback() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => { if (active) setFailed(true); }, 15000);
    async function finishSignIn() {
      try {
        // The browser SDK consumes the implicit OAuth response and persists the session.
        const result = await getBrowserClient()?.auth.getSession();
        if (!result || result.error || !result.data.session) throw new Error("No session");
        if (active) window.location.replace("/");
      } catch {
        if (active) setFailed(true);
      } finally {
        window.clearTimeout(timer);
      }
    }
    void finishSignIn();
    return () => { active = false; window.clearTimeout(timer); };
  }, []);

  return <main className="container appRoot"><section className="card authCard">
    <h1>地図の余白</h1>
    {failed ? <><p role="alert">ログインを完了できませんでした。キャンセルした場合や接続が途切れた場合は、もう一度お試しください。</p><Link href="/">ログイン画面へ戻る</Link></> : <p role="status">ログインを確認しています…</p>}
  </section></main>;
}
