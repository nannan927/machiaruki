"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { memoRequest } from "@/lib/client-api";
import { demoRequest } from "@/lib/demo-store";
import { filterMemos } from "@/lib/memo-search";
import { MapView } from "@/components/MapView";
import { MemoForm } from "@/components/MemoForm";
import { MemoList } from "@/components/MemoList";
import type { Memo } from "@/types/memo";

export function Notebook({ demo = false, onUnsavedChange }: { demo?: boolean; onUnsavedChange?: (value: boolean) => void }) {
  const request = demo ? demoRequest : memoRequest;
  const [memos, setMemos] = useState<Memo[]>([]);
  const [selected, setSelected] = useState<{ lat: number; lng: number } | null>(null);
  const [editing, setEditing] = useState<Memo | null>(null);
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const dirty = useRef(false);
  const busy = useRef(false);
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const serverQuery = demo ? "" : query;
  const dirtyChanged = useCallback((value: boolean) => { dirty.current = value; onUnsavedChange?.(value || busy.current); }, [onUnsavedChange]);
  const busyChanged = useCallback((value: boolean) => { busy.current = value; onUnsavedChange?.(value || dirty.current); }, [onUnsavedChange]);
  function discard() { return !busy.current && (!dirty.current || window.confirm("未保存の内容を破棄して移動しますか？")); }
  useEffect(() => {
    const controller = new AbortController();
    pending.current?.abort(); pending.current = controller;
    const current = ++generation.current;
    const timer = window.setTimeout(async () => {
      setLoading(true); setError(""); setCursor(null); setLoadingMore(false);
      try {
        const data = await request(demo ? "" : `?q=${encodeURIComponent(serverQuery)}`, { signal: controller.signal });
        if (current !== generation.current || controller.signal.aborted) return;
        setMemos(demo ? data : data.items); setCursor(demo ? null : data.nextCursor);
      } catch (err) { if (!controller.signal.aborted && current === generation.current) setError((err as Error).message); }
      finally { if (!controller.signal.aborted && current === generation.current) setLoading(false); }
    }, serverQuery ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [serverQuery, retry, request, demo]);
  const filtered = useMemo(() => demo ? filterMemos(memos, query) : memos, [demo, memos, query]);
  async function more() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true); setError("");
    const current = generation.current;
    try {
      const data = await request(`?q=${encodeURIComponent(serverQuery)}&cursor=${encodeURIComponent(cursor)}`, { signal: pending.current?.signal });
      if (current !== generation.current) return;
      setMemos(items => [...items, ...data.items.filter((item: Memo) => !items.some(existing => existing.id === item.id))]);
      setCursor(data.nextCursor);
    } catch (err) { if (current === generation.current && !(err instanceof DOMException && err.name === "AbortError")) setError((err as Error).message); }
    finally { if (current === generation.current) setLoadingMore(false); }
  }
  function resetForm() { dirtyChanged(false); busyChanged(false); setEditing(null); setVersion(value => value + 1); }
  function edit(memo: Memo) {
    if (!discard()) return;
    dirtyChanged(false); setVersion(value => value + 1); setEditing(memo); setSelected({ lat: memo.lat, lng: memo.lng }); setNotice("");
    document.getElementById("memo-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function invalidate() { ++generation.current; pending.current?.abort(); setLoading(false); setLoadingMore(false); }
  function saved(memo: Memo) {
    invalidate();
    setMemos(current => [memo, ...current.filter(item => item.id !== memo.id)].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    resetForm(); setQuery(""); setNotice("メモを保存しました。");
    if (!demo) setRetry(value => value + 1);
  }
  async function remove(memo: Memo) {
    if (busy.current) throw new Error("保存処理が終わってから削除してください。");
    if (editing?.id === memo.id && !discard()) return;
    await request(`/${memo.id}`, { method: "DELETE", headers: { "If-Match": String(memo.version ?? 1) } });
    invalidate(); setMemos(current => current.filter(item => item.id !== memo.id));
    if (editing?.id === memo.id) resetForm();
    setNotice("メモを削除しました。");
    if (!demo) setRetry(value => value + 1);
  }
  return <>
    <div className="notebookTools"><button type="button" onClick={() => { setLoading(true); setRetry(value => value + 1); }}>一覧を再読み込み</button><span>表示中 {filtered.length} 件{cursor ? "（続きあり）" : ""}</span></div>
    {error && <div className="error card" role="alert"><p>{error}</p></div>}
    <p role="status" className="success">{notice}</p>
    <section className="phoneGrid">
      <MapView demo={demo} selected={selected} memos={filtered} onSelect={coords => { if (!busy.current) setSelected(coords); }} onMemoSelect={edit} />
      <MemoForm request={request} key={`${editing?.id ?? "new"}-${version}`} selected={selected} editing={editing} onDirtyChange={dirtyChanged} onBusyChange={busyChanged} onSaved={saved} onCancel={() => { if (discard()) resetForm(); }} />
      <div><MemoList memos={filtered} total={memos.length} loading={loading} query={query} onQuery={setQuery} onEdit={edit} onDelete={remove} onLocate={memo => { if (!discard()) return; resetForm(); setSelected({ lat: memo.lat, lng: memo.lng }); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        {cursor && <button type="button" disabled={loadingMore || loading} onClick={() => void more()}>{loadingMore ? "読み込み中…" : "さらに50件を読み込む"}</button>}
      </div>
    </section>
  </>;
}
