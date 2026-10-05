"use client";
import { useEffect, useRef, useState } from "react";
import { memoLabel } from "@/lib/walking-data";
import type { Memo } from "@/types/memo";

type Gesture = { id: number; x: number; y: number; dx: number; axis: "x" | "y" | null; wasOpen: boolean };
export function SwipeMemo({ memo, open, disabled, onToggle, onRead, onDelete }: { memo: Memo; open: boolean; disabled: boolean; onToggle: (open: boolean) => void; onRead: () => void; onDelete: (trigger: HTMLElement) => void }) {
  const row = useRef<HTMLDivElement>(null);
  const reader = useRef<HTMLButtonElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const suppressUntil = useRef(0);
  const [offset, setOffset] = useState<number | null>(null);
  const toggle = useRef(onToggle);
  useEffect(() => { toggle.current = onToggle; }, [onToggle]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!row.current?.contains(event.target as Node)) toggle.current(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { toggle.current(false); reader.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  function finish(event: React.PointerEvent<HTMLButtonElement>, cancelled = false) {
    const g = gesture.current; if (!g || g.id !== event.pointerId) return;
    gesture.current = null; setOffset(null);
    if (g.axis || cancelled) suppressUntil.current = performance.now() + 450;
    if (!disabled && g.axis === "x" && !cancelled) onToggle(g.wasOpen ? g.dx < 40 : g.dx <= -40);
    if (event.currentTarget.hasPointerCapture(g.id)) event.currentTarget.releasePointerCapture(g.id);
  }
  const shown = !disabled && (open || (offset !== null && offset < 0));
  return <div ref={row} className={`swipeMemo ${offset !== null ? "isDragging" : ""}`}>
    <button type="button" className="swipeDelete" hidden={!shown} disabled={disabled} aria-label={`「${memoLabel(memo)}」を削除`} onClick={() => { onToggle(false); if (reader.current) onDelete(reader.current); }}>削除</button>
    <button ref={reader} type="button" className="memoryCard" style={{ transform: `translateX(${disabled ? 0 : offset ?? (open ? -88 : 0)}px)` }}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0 || event.clientX < 20 || event.clientX > window.innerWidth - 20) return;
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, axis: null, wasOpen: open };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const g = gesture.current; if (!g || g.id !== event.pointerId) return;
        const dx = event.clientX - g.x, dy = event.clientY - g.y; g.dx = dx;
        if (!g.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
          if (Math.abs(dx) > Math.abs(dy) * 1.25) g.axis = "x";
          else if (Math.abs(dy) >= Math.abs(dx)) g.axis = "y";
        }
        if (g.axis === "x" && !disabled) { if (event.cancelable) event.preventDefault(); setOffset(Math.max(-88, Math.min(0, (g.wasOpen ? -88 : 0) + dx))); }
      }}
      onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}
      onClick={event => { if (event.detail !== 0 && performance.now() < suppressUntil.current) { suppressUntil.current = 0; return; } if (open) onToggle(false); else onRead(); }}>
      <time>{new Date(memo.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</time><strong>{memoLabel(memo)}</strong>{memo.title && <span>{memo.body}</span>}{memo.tags.length > 0 && <small>{memo.tags.join(" · ")}</small>}
    </button>
  </div>;
}
