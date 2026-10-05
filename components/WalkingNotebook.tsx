"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { NotebookSheet as Sheet } from "./NotebookSheet";
import { NotebookMenu, type MenuPanel } from "./NotebookMenu";
import { SwipeMemo } from "./SwipeMemo";
import { memoRequest, MemoRequestError } from "@/lib/client-api";
import { clearDraft, editDraft, emptyDraft, hasDraft, loadDraft, storeDraft, type WalkingDraft, type PendingWrite } from "@/lib/walking-draft";
import { performWrite } from "@/lib/walking-save";
import { parseMemo } from "@/lib/memo-validation";
import { dayGroups, memoLabel, type MapBounds, type Point } from "@/lib/walking-data";
import type { Memo } from "@/types/memo";
import { importLegacyDemo } from "@/lib/guest-store";
const WalkingMap = dynamic(() => import("./WalkingMap").then(m => m.WalkingMap), { ssr: false, loading: () => <div className="walkingMap" role="status">地図を準備しています…</div> });
export function WalkingNotebook({ owner, onUnsavedChange, onSavingChange, request = memoRequest, local = false, revision = 0, accountContent, transferCount = 0, transferring = false }: { owner: string; onUnsavedChange: (value: boolean) => void; onSavingChange: (value: boolean) => void; request?: typeof memoRequest; local?: boolean; revision?: number; accountContent?: React.ReactNode; transferCount?: number; transferring?: boolean }) {
  const [menu, setMenu] = useState<MenuPanel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Memo | null>(null);
  const [deleteFocus, setDeleteFocus] = useState<HTMLElement | null>(null);
  const [swipe, setSwipe] = useState<{ id: string; scope: string } | null>(null);
  const [swipeHint, setSwipeHint] = useState(false);
  const [storageIntro, setStorageIntro] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => { try { setStorageIntro(local && !localStorage.getItem("machinote-storage-intro-v1")); setSwipeHint(!localStorage.getItem("machinote-swipe-hint-v1")); } catch { setStorageIntro(local); setSwipeHint(true); } }, 0);
    return () => clearTimeout(timer);
  }, [local]);
  function dismissIntro() { setStorageIntro(false); try { localStorage.setItem("machinote-storage-intro-v1", "seen"); } catch {} }
  const [tab, setTab] = useState<"map" | "notes">("map");
  const [draft, setDraft] = useState<WalkingDraft>(() => emptyDraft(owner));
  const latestDraft = useRef(draft); const [loaded, setLoaded] = useState(false);
  const [editorAllowed, setEditorAllowed] = useState(false);
  const [writing, setWriting] = useState(false); const [choosing, setChoosing] = useState(false);
  const [mapPicking, setMapPicking] = useState(false);
  const [selected, setSelected] = useState<Point | null>(null); const [focus, setFocus] = useState<Point | null>(null);
  const [location, setLocation] = useState<(Point & { accuracy: number; at: number }) | null>(null);
  const [locating, setLocating] = useState(false); const geoGeneration = useRef(0);
  const [bounds, setBounds] = useState<MapBounds | null>(null); const [pins, setPins] = useState<Memo[]>([]); const [truncated, setTruncated] = useState(false);
  const [mapLoading, setMapLoading] = useState(true); const [mapError, setMapError] = useState("");
  const [notes, setNotes] = useState<Memo[]>([]); const [cursor, setCursor] = useState<string | null>(null);
  const [notesLoading, setNotesLoading] = useState(false); const [notesError, setNotesError] = useState(""); const [moreBusy, setMoreBusy] = useState(false);
  const [query, setQuery] = useState(""); const [refresh, setRefresh] = useState(0);
  const [detail, setDetail] = useState<Memo[] | null>(null); const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [localStatus, setLocalStatus] = useState("");
  const durable = useRef(false);
  const [localProblem, setLocalProblem] = useState(false);
  const [exporting, setExporting] = useState(false); const notesGeneration = useRef(0);
  const changeDraft = useCallback((next: WalkingDraft) => { durable.current = false; latestDraft.current = next; setDraft(next); if (hasDraft(next)) setLocalStatus("端末に下書きを保存中…"); }, []);
  useEffect(() => {
    let active = true; let release: (() => void) | undefined;
    const geo = geoGeneration;
    async function initialize() {
      try {
        if (!navigator.locks) { setError("このブラウザーでは安全な下書き編集を開始できません。新しいSafariまたはChromeで開いてください。"); return; }
        await navigator.locks.request(`machinote-draft:${owner}`, { ifAvailable: true }, async lock => {
          if (!active) return;
          if (!lock) { setError("別のタブで記録を編集中です。そのタブを閉じてから再読み込みしてください。"); return; }
          setEditorAllowed(true);
          try { const saved = await loadDraft(owner); if (active) { if (saved) { changeDraft(saved); setLocalStatus("前回の下書きが端末に残っています。"); } setLoaded(true); } }
          catch (err) { if (active) { setLocalStatus((err as Error).message); setError((err as Error).message); } }
          await new Promise<void>(resolve => { release = resolve; if (!active) resolve(); });
        });
      } catch { if (active) setError("下書きを開けません。ページを再読み込みしてください。"); }
    }
    const timer = setTimeout(() => void initialize(), 0);
    return () => { active = false; clearTimeout(timer); release?.(); geo.current++; };
  }, [owner, changeDraft]);
  useEffect(() => {
    onUnsavedChange(hasDraft(draft) || busy);
    onSavingChange(busy);
  }, [draft, busy, onUnsavedChange, onSavingChange]);
  useEffect(() => {
    if (!loaded || !editorAllowed || !hasDraft(draft)) return;
    let active = true;
    // Each edit is enqueued immediately; a last keystroke is not left in a debounce timer.
    void storeDraft(draft).then(() => { if (active) { durable.current = true; setLocalProblem(false); setLocalStatus("下書きを端末に保存しました。"); } }).catch(() => { if (active) { setLocalProblem(true); setLocalStatus("端末に下書きを保存できません。画面を閉じる前に保存するか、文章をコピーしてください。"); } });
    const warn = (event: BeforeUnloadEvent) => { if (busyRef.current || !durable.current) { event.preventDefault(); event.returnValue = ""; } };
    const hidden = () => { if (document.visibilityState === "hidden") void storeDraft(latestDraft.current).catch(() => {}); };
    window.addEventListener("beforeunload", warn); document.addEventListener("visibilitychange", hidden);
    return () => { active = false; window.removeEventListener("beforeunload", warn); document.removeEventListener("visibilitychange", hidden); };
  }, [draft, loaded, editorAllowed]);
  useEffect(() => {
    if (!bounds || tab !== "map") return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setMapLoading(true); setMapError("");
      try {
        const params = new URLSearchParams({ ...Object.fromEntries(Object.entries(bounds).map(([k, v]) => [k, String(v)])), q: query });
        const data = await request(`/map?${params}`, { signal: controller.signal });
        if (!controller.signal.aborted) { setPins(data.items); setTruncated(data.truncated); }
      } catch (err) { if (!controller.signal.aborted) setMapError((err as Error).message); }
      finally { if (!controller.signal.aborted) setMapLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [bounds, query, refresh, tab, request, revision]);
  useEffect(() => {
    if (tab !== "notes") return;
    const controller = new AbortController(); const counter = notesGeneration; const generation = ++counter.current;
    const timer = setTimeout(async () => {
      setNotesLoading(true); setNotesError(""); setCursor(null); setMoreBusy(false);
      try { const data = await request(`?q=${encodeURIComponent(query)}`, { signal: controller.signal }); if (!controller.signal.aborted && generation === notesGeneration.current) { setNotes(data.items); setCursor(data.nextCursor); } }
      catch (err) { if (!controller.signal.aborted) setNotesError((err as Error).message); }
      finally { if (!controller.signal.aborted) setNotesLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); ++counter.current; };
  }, [tab, query, refresh, request, revision]);
  async function more() {
    if (!cursor || moreBusy) return; const generation = notesGeneration.current; setMoreBusy(true);
    try { const data = await request(`?q=${encodeURIComponent(query)}&cursor=${encodeURIComponent(cursor)}`); if (generation === notesGeneration.current) { setNotes(items => [...items, ...data.items.filter((m: Memo) => !items.some(existing => existing.id === m.id))]); setCursor(data.nextCursor); } }
    catch (err) { if (generation === notesGeneration.current) setNotesError((err as Error).message); }
    finally { if (generation === notesGeneration.current) setMoreBusy(false); }
  }
  function patch(fields: Partial<WalkingDraft>) { changeDraft({ ...latestDraft.current, ...fields, updatedAt: Date.now() }); }
  function select(point: Point) {
    geoGeneration.current++; setLocating(false); setSelected(point); setMapPicking(false);
    if (choosing) { patch({ point }); setChoosing(false); setWriting(true); }
  }
  function locate(forDraft = false) {
    if (!navigator.geolocation) { setError("現在地を取得できません。地図で場所を選べます。"); return; }
    const generation = ++geoGeneration.current; setLocating(true); setError("");
    navigator.geolocation.getCurrentPosition(position => {
      if (generation !== geoGeneration.current) return;
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      setLocation({ ...point, accuracy: Math.max(0, position.coords.accuracy), at: Date.now() }); setFocus(point); setSelected(point); setLocating(false);
      if (forDraft) patch({ point });
    }, failure => { if (generation === geoGeneration.current) { setLocating(false); setError(failure.code === 1 ? "位置情報が許可されていません。地図をタップして場所を選べます。" : "現在地を取得できませんでした。地図から選ぶか、もう一度お試しください。"); } }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  }
  function begin() {
    setError("");
    if (!hasDraft(latestDraft.current)) changeDraft({ ...emptyDraft(owner), point: selected });
    setWriting(true);
  }
  async function discard() {
    if (busyRef.current || !window.confirm("この端末の下書きを破棄しますか？ 保存済みのメモは削除されません。")) return;
    try { await clearDraft(owner); changeDraft(emptyDraft(owner)); setLocalStatus(""); setWriting(false); setChoosing(false); setError(""); }
    catch (err) { setError((err as Error).message); }
  }
  async function submit(event?: React.FormEvent) {
    event?.preventDefault(); if (busyRef.current || !loaded || !editorAllowed) return;
    let operation = latestDraft.current.pending;
    const retry = !!operation;
    try {
      if (!operation) {
        const d = latestDraft.current;
        if (!d.point) { setError("場所を選んでから保存してください。文章は下書きに残っています。"); return; }
        const input = parseMemo({ title: d.title, body: d.body, ...d.point, tags: d.tags.split(",").map(t => t.trim()).filter(Boolean) });
        operation = { method: d.memoId ? "PATCH" : "POST", id: d.memoId ?? crypto.randomUUID(), version: d.baseVersion, input };
      }
      geoGeneration.current++; setLocating(false);
      busyRef.current = true; setBusy(true); setError("");
      const pending = { ...latestDraft.current, pending: operation }; changeDraft(pending);
      try { await storeDraft(pending); } catch { setLocalStatus("端末保存は利用できません。この画面を閉じずに保存結果をご確認ください。"); }
      const result = await performWrite(operation, retry, request);
      // Clear the durable operation before reporting success, so a restored draft cannot replay it.
      try { await clearDraft(owner); } catch { setError("記録の保存は完了しましたが、端末の下書きを消せませんでした。再確認してください。"); return; }
      changeDraft(emptyDraft(owner)); setLocalStatus(""); setLocalProblem(false); setWriting(false); setDetail(null); setSelected(null); setChoosing(false); setRefresh(n => n + 1);
      setMessage(result ? (local ? "このブラウザーに保存しました。" : "保存しました。言葉がこの場所に残りました。") : "メモを削除しました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できませんでした。下書きは残っています。");
    } finally { busyRef.current = false; setBusy(false); }
  }
  function askRemove(memo: Memo, trigger: HTMLElement) {
    setError(""); setSwipe(null);
    if (!loaded || !editorAllowed || busyRef.current || transferring) return;
    if (hasDraft(latestDraft.current)) { setError("先に下書きを保存するか破棄してください。"); return; }
    setDeleteFocus(trigger); setDeleteTarget(memo);
  }
  async function remove(memo: Memo) {
    if (!loaded || !editorAllowed || busyRef.current || transferring) return;
    if (hasDraft(latestDraft.current)) { setError("先に下書きを保存するか破棄してください。"); return; }
    setDeleteTarget(null);
    const operation: PendingWrite = { method: "DELETE", id: memo.id, version: memo.version ?? 1 };
    changeDraft({ ...editDraft(owner, memo), pending: operation }); setDetail(null); setWriting(true);
    await submit();
  }
  async function checkRemote() {
    const operation = latestDraft.current.pending; if (!operation) return;
    try { const memo = await request(`/${operation.id}`); setDetail([memo]); setWriting(false); }
    catch (err) { setError(err instanceof MemoRequestError && err.status === 404 ? "保存先にこの記録はありません。再試行できます。" : (err as Error).message); }
  }
  async function exportAll() {
    setExporting(true); setError("");
    try {
      const records = new Map<string, Memo>(); let next: string | null = null;
      do { const data = await request(next ? `?cursor=${encodeURIComponent(next)}` : ""); for (const memo of data.items) records.set(memo.id, memo); next = data.nextCursor; } while (next);
      const blob = new Blob([JSON.stringify({ format: "machinote", version: 1, exportedAt: new Date().toISOString(), count: records.size, memos: [...records.values()] }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `machinote-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage(`${records.size}件を書き出しました。`);
    } catch (err) { setError((err as Error).message); } finally { setExporting(false); }
  }
  async function clearLocalRecords() {
    if (!local || !editorAllowed || busyRef.current || !window.confirm("このブラウザーの記録と下書きをすべて削除しますか？ Googleに引き継いだ記録と旧デモは残ります。元に戻せません。")) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      await request("/all", { method: "DELETE" }); await clearDraft(owner);
      changeDraft(emptyDraft(owner)); setDetail(null); setPins([]); setNotes([]); setRefresh(n => n + 1);
      setMessage("このブラウザーの記録と下書きを削除しました。");
    } catch (error) { setError((error as Error).message); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function copyOldDemo() {
    if (!local || !editorAllowed || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try { const count = await importLegacyDemo(); setRefresh(n => n + 1); setMessage(count ? `以前のデモから${count}件をコピーしました。サンプルは含めていません。` : "コピーする新しい記録はありません。サンプルは含めません。"); }
    catch (error) { setRefresh(n => n + 1); setError((error as Error).message); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const groups = useMemo(() => dayGroups(notes), [notes]);
  const editable = loaded && editorAllowed && !busy && !transferring;
  const swipeScope = `${tab}:${query}:${refresh}:${revision}:${!!menu}:${!!detail}:${writing}:${!!deleteTarget}`;
  const showMenu = (panel: MenuPanel | null) => { setSwipe(null); setMenu(panel); setError(""); setMessage(""); };
  const openMemo = (memos: Memo[]) => { setDetail(memos); setError(""); };
  return <div className="walkingNotebook">
    <header className="notebookHeader"><div><p className="eyebrow">いつもの道に、小さな発見を。</p><h1>地図の余白</h1></div><button type="button" className="notebookMenuButton" onClick={() => showMenu("menu")}>メニュー</button></header>
    <button type="button" className="storageShortcut" onClick={() => showMenu("account")}><span aria-hidden="true">●</span><span>{local ? "保存先：このブラウザー" : "保存先：アカウント"}</span><span aria-hidden="true">›</span></button>
    {storageIntro && <aside className="storageIntro"><p>この端末のブラウザーに保存します。閲覧データを削除すると記録も失われます。ほかの端末でも使いたいときは、Googleで引き継げます。</p><button type="button" onClick={dismissIntro}>説明を閉じる</button></aside>}
    {transferCount > 0 && <button type="button" className="transferNotice" onClick={() => showMenu("account")}>このブラウザーの{transferCount}件を引き継げます <span aria-hidden="true">›</span></button>}
    <div className="walkingSearch"><label><span className="visuallyHidden">言葉を探す</span><input type="search" placeholder="言葉・タイトル・タグ" value={query} maxLength={200} onChange={event => setQuery(event.target.value)} /></label>{query && <button type="button" onClick={() => setQuery("")}>検索を解除</button>}</div>
    {hasDraft(draft) && <div className="draftBanner"><span>{draft.pending ? "結果を確認したい保存操作があります。" : "書きかけの言葉があります。"}</span><button disabled={!editable} onClick={() => setWriting(true)}>続きを書く</button></div>}
    {message && !menu && <p className="success" role="status">{message}</p>}
    {error && !menu && !writing && !detail && !deleteTarget && <p className="error" role="alert">{error}</p>}
    {localProblem && hasDraft(draft) && !writing && <p className="error" role="alert">{localStatus}</p>}
    <section hidden={tab !== "map"} aria-label="地図で記録を探す">
      <div className="walkingMapArea"><div className="mapActionsRow"><button disabled={locating} onClick={() => locate(false)}>{locating ? "現在地を取得中…" : "現在地を表示"}</button></div>
      <WalkingMap showCenterSelect={choosing || mapPicking} owner={owner} selected={choosing ? draft.point : selected} focus={focus} location={location} memos={pins} onSelect={select} onBounds={setBounds} onOpen={openMemo} /></div>
      {!choosing && !mapPicking && <button type="button" className="mapPickEntry" onClick={() => setMapPicking(true)}>場所を選ぶ</button>}
      <div className="mapSummary"><span>{mapLoading ? "この範囲の記録を確認中…" : `この範囲に表示中 ${pins.length} 件`}</span><span>緑：記録 · 茶：選択 · 青：取得時の現在地</span></div>
      {truncated && <p role="status">この範囲には200件を超える記録があります。地図を拡大して絞り込んでください。</p>}
      {mapError && <p role="alert" className="error">{mapError} 表示中の記録は最新でない可能性があります。<button onClick={() => setRefresh(n => n + 1)}>記録を再読み込み</button></p>}
      {choosing && <p className="selectionHint" role="status">この言葉を残す場所を地図で選んでください。<button onClick={() => { setChoosing(false); setWriting(true); }}>入力に戻る</button></p>}
      {!selected && !choosing && <p className="hint">現在地を表示するか、地図をタップ。場所を決める前に書き始めても大丈夫です。</p>}
      {location && <small>取得時刻 {new Date(location.at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} · 精度 約{Math.round(location.accuracy)}m。ずれる場合は地図で修正できます。</small>}
    </section>
    <section hidden={tab !== "notes"} className="walkingNotes" aria-label="日付別の散歩ノート">
      <h2>{query ? "言葉の検索結果" : "散歩ノート"}</h2><p className="notebookLead">歩いた日の、小さな記憶。</p>
      {swipeHint && notes.length > 0 && <p className="swipeHint">左にスライドすると削除できます</p>}
      <span className="visuallyHidden" role="status">{swipe?.scope === swipeScope ? "削除ボタンを表示しました。押すと対象の確認へ進みます。" : ""}</span>
      {notesError && <p className="error" role="alert">{notesError}<button onClick={() => setRefresh(n => n + 1)}>記録を再読み込み</button></p>}
      {notesLoading ? <p role="status">記録を読み込み中…</p> : groups.length === 0 ? <p>{query ? "一致する言葉はありません。" : "まだ記録がありません。短い一言から残してみましょう。"}</p> : groups.map(([day, items]) => <section key={day} className="dayGroup"><h3>{day === new Date().toLocaleDateString("ja-JP") ? "今日の散歩" : day} <small>表示中 {items.length}件</small></h3>{items.map(memo => <SwipeMemo key={`${memo.id}:${memo.version}`} memo={memo} disabled={!editable || hasDraft(draft)} open={swipe?.id === memo.id && swipe.scope === swipeScope} onToggle={open => { setSwipe(open ? { id: memo.id, scope: swipeScope } : null); if (open) { setSwipeHint(false); try { localStorage.setItem("machinote-swipe-hint-v1", "seen"); } catch {} } }} onRead={() => openMemo([memo])} onDelete={trigger => askRemove(memo, trigger)} />)}</section>)}
      {cursor && <button disabled={notesLoading || moreBusy} onClick={() => void more()}>{moreBusy ? "読み込み中…" : "さらに前の記録を読む"}</button>}
    </section>
    <nav className="walkingNav" aria-label="ノートの表示"><button aria-pressed={tab === "map"} onClick={() => setTab("map")}>地図</button><button className="primaryBtn" disabled={!editable} onClick={begin}>書く</button><button aria-pressed={tab === "notes"} onClick={() => setTab("notes")}>ノート</button></nav>
    <NotebookMenu panel={menu} setPanel={showMenu} local={local} editable={editable} hasDraft={hasDraft(draft)} busy={busy || transferring} exporting={exporting} error={error} message={message} accountContent={accountContent} onExport={() => void exportAll()} onClear={() => void clearLocalRecords()} onCopy={() => void copyOldDemo()} onReload={() => { setRefresh(n => n + 1); showMenu(null); }} />
    {deleteTarget && <Sheet title="この記録を削除しますか？" returnFocus={deleteFocus} close={() => setDeleteTarget(null)}>
      <div className="settingsInset deletePreview"><time>{new Date(deleteTarget.created_at).toLocaleString("ja-JP")}</time>{deleteTarget.title && <h3>{deleteTarget.title}</h3>}<p>{deleteTarget.body.length > 300 ? `${deleteTarget.body.slice(0, 300)}…（本文の一部）` : deleteTarget.body}</p></div>
      <p className="menuIntro">{local ? "この端末のブラウザーの記録" : "現在のアカウントの記録"}</p><p>この1件だけを削除します。削除すると元に戻せません。</p><p>引き継ぎで作った別のコピーや、以前のデモの記録は残ります。</p>
      {error && <p role="alert" className="error">{error}</p>}<button type="button" onClick={() => setDeleteTarget(null)}>キャンセル</button><button type="button" className="dangerBtn" disabled={!editable || hasDraft(draft)} onClick={() => void remove(deleteTarget)}>この1件を削除</button>
    </Sheet>}
    {writing && <Sheet title={draft.pending?.method === "DELETE" ? "削除結果を確認" : draft.memoId ? "言葉を編集" : "ここで見つけたこと"} close={() => { if (!busy) { geoGeneration.current++; setLocating(false); setWriting(false); } }}>
      <form onSubmit={event => void submit(event)}><fieldset disabled={busy || !!draft.pending}>
        <label>この場所で何を見つけましたか？<textarea autoFocus value={draft.body} maxLength={2000} required rows={5} placeholder="パン屋の前、甘い匂い。" onChange={event => patch({ body: event.target.value })} /></label>
        <details><summary>タイトル・タグを添える（任意）</summary><label>タイトル<input maxLength={120} value={draft.title} onChange={event => patch({ title: event.target.value })} /></label><label>タグ（カンマ区切り）<input value={draft.tags} onChange={event => patch({ tags: event.target.value })} /></label></details>
        <div className="placeConfirm"><strong>{draft.point ? "地図で選んだ場所に残します" : "場所はあとで選べます"}</strong>{draft.point && <details><summary>場所の詳細</summary><small>{draft.point.lat.toFixed(5)}, {draft.point.lng.toFixed(5)}</small></details>}<div className="memoTools"><button type="button" onClick={() => { geoGeneration.current++; setLocating(false); setWriting(false); setChoosing(true); setTab("map"); }}>地図で場所を選ぶ</button><button type="button" disabled={locating} onClick={() => locate(true)}>{locating ? "現在地を取得中…" : "現在地を使う"}</button></div></div>
      </fieldset>
      {draft.pending && <p>送信した内容を保全しています。結果を確認してから続きを編集できます。</p>}
      <p className="draftStatus" role="status">{busy ? "通信しています。結果を確認中…" : localStatus || "入力した言葉はこの端末に下書き保存されます。"}</p>
      {error && <p className="error" role="alert">{error}</p>}
      {!draft.point && !draft.pending && <small>保存するには、言葉を残す場所を選んでください。</small>}
      <div className="sheetSave"><button className="primaryBtn" disabled={!editable || (!draft.pending && (!draft.body.trim() || !draft.point))}>{busy ? "確認中…" : draft.pending ? "結果を確認して再試行" : "この場所に保存"}</button><button type="button" disabled={busy} onClick={() => { geoGeneration.current++; setLocating(false); setWriting(false); }}>下書きのまま閉じる</button></div>
      {draft.pending && <button type="button" disabled={busy} onClick={() => void checkRemote()}>保存済みの記録を確認</button>}
      <button type="button" disabled={busy} onClick={() => void discard()}>端末の下書きを破棄</button>
      <small>端末のデータを消すと下書きも消えます。共有端末ではログアウト時に下書きを削除してください。</small>
      </form>
    </Sheet>}
    {detail && <Sheet title={detail.length > 1 ? `この場所の${detail.length}つの記録` : "場所に残した言葉"} close={() => setDetail(null)}>
      {detail.length > 1 ? [...detail].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(memo => <button key={memo.id} className="memoryCard" onClick={() => setDetail([memo])}><time>{new Date(memo.created_at).toLocaleString("ja-JP")}</time><strong>{memoLabel(memo)}</strong></button>) : detail.map(memo => <article key={memo.id} className="memoryDetail"><time>{new Date(memo.created_at).toLocaleString("ja-JP")}</time>{memo.title && <h3>{memo.title}</h3>}<p className="memoBody">{memo.body}</p><div className="tagGroup">{memo.tags.map(tag => <button key={tag} onClick={() => { setQuery(tag); setDetail(null); setTab("notes"); }}>{tag}</button>)}</div><button onClick={() => { setFocus({ lat: memo.lat, lng: memo.lng }); setDetail(null); setTab("map"); }}>この場所を地図で見る</button><div className="memoTools"><button disabled={!editable} onClick={() => { if (hasDraft(latestDraft.current)) { setError("書きかけの下書きがあります。先に保存するか破棄してください。"); return; } changeDraft(editDraft(owner, memo)); setDetail(null); setWriting(true); }}>編集する</button></div><div className="detailDanger"><button disabled={!editable} onClick={event => askRemove(memo, event.currentTarget)}>この記録を削除</button></div></article>)}
      {error && <p className="error" role="alert">{error}</p>}
    </Sheet>}
  </div>;
}
