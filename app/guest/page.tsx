"use client";
import { useState } from "react";
import Link from "next/link";
import { WalkingNotebook } from "@/components/WalkingNotebook";
import { GUEST_OWNER, guestRequest } from "@/lib/guest-store";

export default function GuestPage() {
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(false);
  return <main className="container appRoot walkingRoot">
    <header className="hero"><p className="eyebrow">いつもの道に、小さな発見を。</p><h1>地図の余白</h1></header>
    <aside className="storageNotice"><div><strong>保存先：このブラウザー</strong><p>登録なしで書いて、読み返せます。記録はこの端末だけに保存されます。</p></div><Link aria-disabled={saving} onClick={event => { if (saving) event.preventDefault(); }} href="/">ほかの端末でも使う・ログイン →</Link><small>閲覧データの削除などで記録が消えることがあります。{draft && "書きかけはこのブラウザーに残ります。引き継ぐ前にメモを保存してください。"}</small></aside>
    <WalkingNotebook owner={GUEST_OWNER} request={guestRequest} local onUnsavedChange={setDraft} onSavingChange={setSaving} />
    <p className="guestFooter"><Link href="/privacy">データの扱い</Link> · <Link href="/demo">以前のデモと記録を開く</Link></p>
  </main>;
}
