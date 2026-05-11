"use client";

import { useState } from "react";
import type { CreateMemoInput } from "@/types/memo";

type MemoFormProps = {
  selected: { lat: number; lng: number } | null;
  onSaved: () => Promise<void>;
};

export function MemoForm({ selected, onSaved }: MemoFormProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      setError("先に座標を選択してください。");
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload: CreateMemoInput = {
      title,
      body,
      lat: selected.lat,
      lng: selected.lng,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    const response = await fetch("/api/memos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "保存に失敗しました。");
      setIsSaving(false);
      return;
    }

    setTitle("");
    setBody("");
    setTags("");
    await onSaved();
    setIsSaving(false);
  }

  return (
    <section className="card">
      <h2>メモ作成</h2>
      <p className="hint">場所を選んだ直後に、30秒で記録するのがおすすめです。</p>
      <form onSubmit={handleSubmit} className="form">
        <label>
          タイトル
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          本文*
          <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={4} />
        </label>
        <label>
          タグ（カンマ区切り）
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <p className="coord">lat: {selected?.lat ?? "未選択"}</p>
        <p className="coord">lng: {selected?.lng ?? "未選択"}</p>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={isSaving}>
          {isSaving ? "保存中..." : "この場所に保存"}
        </button>
      </form>
    </section>
  );
}
