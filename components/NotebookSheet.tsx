"use client";
import { useEffect, useRef } from "react";

export function NotebookSheet({ title, close, children, open = true, className = "", returnFocus }: { title: string; close: () => void; children: React.ReactNode; open?: boolean; className?: string; returnFocus?: HTMLElement | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  const exit = useRef(close);
  const focusTarget = useRef(returnFocus);
  useEffect(() => { exit.current = close; focusTarget.current = returnFocus; }, [close, returnFocus]);
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    const previous = focusTarget.current ?? document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const viewport = window.visualViewport;
    const resize = () => {
      if (!dialog || !viewport) return;
      dialog.style.maxHeight = `${Math.max(160, viewport.height - 24)}px`;
      dialog.style.bottom = `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`;
    };
    resize(); viewport?.addEventListener("resize", resize); viewport?.addEventListener("scroll", resize);
    return () => {
      viewport?.removeEventListener("resize", resize); viewport?.removeEventListener("scroll", resize);
      dialog?.close(); if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);
  return <dialog ref={ref} className={`walkingSheet ${className}`} aria-label={title} onCancel={event => { event.preventDefault(); exit.current(); }}>
    <div className="sheetHeader"><h2>{title}</h2><button type="button" onClick={close} aria-label="閉じる">閉じる</button></div>{children}
  </dialog>;
}
