"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GUEST_OWNER, guestRecords, importReceipts, receiptKey, saveReceipt } from "@/lib/guest-store";
import { memoRequest } from "@/lib/client-api";
import { parseMemo } from "@/lib/memo-validation";
import type { Memo } from "@/types/memo";

export function GuestTransfer({ owner, email, onComplete, disabled = false, onBusy }: { owner: string; email: string; onComplete: () => void; disabled?: boolean; onBusy: (busy: boolean) => void }) {
  const [count, setCount] = useState(0);
  const [preview, setPreview] = useState<Memo[] | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void guestRecords().then(records => { if (active) setCount(records.length); }).catch(() => { if (active) setError("このブラウザーの記録を確認できません。元の記録は変更していません。"); });
    return () => { active = false; };
  }, [owner]);
  async function review() {
    setError(""); setConfirmed(false);
    try {
      const records = await guestRecords(); const receipts = await importReceipts();
      const remaining = records.filter(m => !receipts.some(r => r.key === receiptKey(owner, m) && r.done));
      setPreview(remaining);
      setMessage(remaining.length ? "" : "このアカウントへの引き継ぎは完了しています。端末の記録は別のコピーとして残っています。");
    } catch (error) { setError((error as Error).message); }
  }
  async function transfer() {
    if (!confirmed || !preview?.length || busy || disabled) return;
    setBusy(true); onBusy(true); setError("");
    let completed = 0;
    try {
      if (!navigator.locks) throw new Error("このブラウザーでは引き継ぎできません。新しいSafariまたはChromeでお試しください。");
      await navigator.locks.request(`machinote-draft:${GUEST_OWNER}`, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("登録なしで使っているタブを閉じてから、もう一度引き継いでください。");
        const current = await guestRecords();
        if (preview.some(m => !current.some(c => c.id === m.id && c.version === m.version && JSON.stringify(c) === JSON.stringify(m)))) throw new Error("端末の記録が変わりました。「記録を確認する」から確認し直してください。");
        const receipts = await importReceipts();
        for (const memo of preview) {
          const key = receiptKey(owner, memo);
          const receipt = receipts.find(r => r.key === key) ?? { key, id: crypto.randomUUID(), done: false };
          if (!receipt.done) {
            // Persist the retry identity before sending any content. Keep originals on every failure.
            await saveReceipt(receipt);
            await memoRequest("", { method: "POST", headers: { "Idempotency-Key": receipt.id, "X-Memo-Created-At": memo.created_at }, body: JSON.stringify(parseMemo({ ...memo, title: memo.title ?? undefined })) }, owner);
            await saveReceipt({ ...receipt, done: true });
          }
          completed++; setMessage(`${completed} / ${preview.length} 件を確認しました。`);
        }
      });
      setPreview(null); setConfirmed(false);
      setMessage(`${completed}件を引き継ぎました。今後はこのアカウントのノートで記録してください。端末側のコピーは自動同期されません。`);
      onComplete();
    } catch (error) { setError(`${(error as Error).message} 元の記録はこのブラウザーに残っています。再試行しても、完了した分は重複しません。`); }
    finally { setBusy(false); onBusy(false); }
  }
  if (!count && !error) return null;
  return <section className="transferPanel" aria-label="端末の記録を引き継ぐ">
    <h2>このブラウザーに{count}件の記録があります</h2>
    <p>引き継ぎ先：<strong>{email}</strong></p>
    <p>内容を確認してからアカウントにコピーします。端末の元の記録は残り、自動では送信しません。</p>
    <button type="button" disabled={busy || disabled} onClick={() => void review()}>記録を確認する</button>
    {preview && preview.length > 0 && <div className="transferReview"><ul>{preview.map(m => <li key={m.id}><time>{new Date(m.created_at).toLocaleDateString("ja-JP")}</time> {m.title || m.body.slice(0, 60)}</li>)}</ul><label className="transferConsent"><input type="checkbox" disabled={busy} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />この記録が自分のもので、表示中のアカウントに引き継ぐことを確認しました</label><button type="button" className="primaryBtn" disabled={busy || disabled || !confirmed} onClick={() => void transfer()}>{busy ? "引き継ぎ中…" : `${preview.length}件をこのアカウントに引き継ぐ`}</button></div>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert" className="error">{error}</p>}
    <Link href="/guest" onClick={event => { if (busy) event.preventDefault(); }}>端末のノートを開く</Link>
  </section>;
}
