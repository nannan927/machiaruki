"use client";
import { useEffect, useRef, useState } from "react";
import { memoRequest } from "@/lib/client-api";
import { parseMemo } from "@/lib/memo-validation";
import type { Memo } from "@/types/memo";

type Props = { onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void; request?: typeof memoRequest; selected: { lat: number; lng: number } | null; editing: Memo | null; onSaved: (memo: Memo) => void; onCancel: () => void };
export function MemoForm({ selected, editing, onSaved, onCancel, request = memoRequest, onDirtyChange, onBusyChange }: Props) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [body, setBody] = useState(editing?.body ?? "");
  const [tags, setTags] = useState(editing?.tags.join(", ") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operationId = useRef<string | null>(null);
  const submitting = useRef(false);
  const dirty = title !== (editing?.title ?? "") || body !== (editing?.body ?? "") || tags !== (editing?.tags.join(", ") ?? "") || !!(editing && selected && (selected.lat !== editing.lat || selected.lng !== editing.lng));
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!selected) { setError("先に場所を選んでください。"); return; }
    submitting.current = true;
    setBusy(true); setError("");
    try {
      const payload = parseMemo({ title, body, ...selected, tags: tags.split(",").map(tag => tag.trim()).filter(Boolean) });
      operationId.current ??= crypto.randomUUID();
      const memo = await request(editing ? `/${editing.id}` : "", { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload), headers: editing ? { "If-Match": String(editing.version ?? 1) } : { "Idempotency-Key": operationId.current } });
      onSaved(memo);
    } catch (err) { setError(err instanceof Error ? err.message : "保存できませんでした。"); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <section className="card toneWrite" id="memo-form"><h2>{editing ? "2. メモを編集" : "2. 場所の記録"}</h2>
    <form onSubmit={submit} className="form"><fieldset disabled={busy}>
      <label>タイトル<input value={title} maxLength={120} onChange={e => setTitle(e.target.value)} placeholder="夕陽が階段に落ちる時間" /></label>
      <label>本文（必須）<textarea value={body} maxLength={2000} onChange={e => setBody(e.target.value)} required rows={5} /></label>
      <label>タグ（カンマ区切り・10個まで）<input value={tags} onChange={e => setTags(e.target.value)} placeholder="路地, 風, 商店街" /></label>
      <p className="coords">{selected ? `${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}` : "先に場所を選んでください。"}</p>
      {editing && <p className="hint">地図で選び直すと、このメモの場所も変更できます。</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primaryBtn" type="submit" disabled={busy || !selected}>{busy ? "保存中…" : editing ? "変更を保存" : "メモを保存"}</button>
      {(editing || dirty) && <button type="button" onClick={onCancel}>{editing ? "編集をやめる" : "入力をクリア"}</button>}
    </fieldset></form>
  </section>;
}
