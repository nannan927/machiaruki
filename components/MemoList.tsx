"use client";
import { useState } from "react";
import type { Memo } from "@/types/memo";
export function MemoList({ memos, total, query, onQuery, onEdit, onDelete, onLocate, loading }: { memos: Memo[]; total: number; query: string; onQuery: (query: string) => void; onEdit: (memo: Memo) => void; onDelete: (memo: Memo) => Promise<void>; onLocate: (memo: Memo) => void; loading: boolean }) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove(memo: Memo) {
    setBusy(true); setError("");
    try { await onDelete(memo); setConfirmId(null); } catch (err) { setError(err instanceof Error ? err.message : "削除できませんでした。"); } finally { setBusy(false); }
  }
  return <section className="card toneList"><div className="cardHeader"><h2>3. 散歩ノート</h2><small>{memos.length} / {total} 件</small></div>
    <label className="searchLabel">メモを検索<input type="search" maxLength={200} value={query} onChange={e => onQuery(e.target.value)} placeholder="タイトル・本文・タグ" /></label>
    {error && <p className="error" role="alert">{error}</p>}
    {loading ? <p role="status">メモを読み込み中…</p> : memos.length === 0 ? <p>{query ? "条件に合うメモがありません。" : "まだメモがありません。最初の気づきを残しましょう。"}</p> : <ul className="memoList">{memos.map(memo => <li key={memo.id} className="memoItem">
      <strong>{memo.title || "（無題）"}</strong><p className="memoBody">{memo.body}</p><small>{new Date(memo.created_at).toLocaleDateString("ja-JP")} · {memo.lat.toFixed(5)}, {memo.lng.toFixed(5)}</small>
      <div className="tagGroup">{memo.tags.map((tag, index) => <button className="tag" type="button" key={`${tag}-${index}`} onClick={() => onQuery(tag)}>{tag}</button>)}</div>
      <div className="memoTools"><button disabled={busy} type="button" onClick={() => onLocate(memo)}>地図へ</button><button disabled={busy} type="button" onClick={() => onEdit(memo)}>編集</button><button disabled={busy} type="button" onClick={() => { setConfirmId(memo.id); setError(""); }}>削除</button></div>
      {confirmId === memo.id && <div className="deleteConfirm"><p>このメモを削除しますか？ 元に戻せません。</p><div className="memoTools"><button className="dangerBtn" disabled={busy} onClick={() => void remove(memo)}>{busy ? "削除中…" : "削除する"}</button><button disabled={busy} onClick={() => setConfirmId(null)}>キャンセル</button></div></div>}
    </li>)}</ul>}
  </section>;
}
