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
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected) {
      setError("先に『この場所を選ぶ』を押してください。");
      setSuccess(null);
      return;
    }

    const trimmedBody = body.trim();
    if (!trimmedBody) {
      setError("本文を入力してください。");
      setSuccess(null);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const payload: CreateMemoInput = {
      title: title.trim() || undefined,
      body: trimmedBody,
      lat: selected.lat,
      lng: selected.lng,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    try {
      const response = await fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "保存に失敗しました。");
        return;
      }

      setTitle("");
      setBody("");
      setTags("");
      setSuccess("この場所にメモを保存しました。");
      await onSaved();
    } catch {
      setError("通信エラーが発生しました。時間を置いて再度お試しください。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="card toneWrite">
      <div className="cardHeader">
        <h2>2. 場所の記録</h2>
      </div>
      <form onSubmit={handleSubmit} className="form">
        <label>
          タイトル
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="夕陽が階段に落ちる時間"
          />
        </label>
        <label>
          本文*
          <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={5} />
        </label>
        <label>
          タグ（カンマ区切り）
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="路地, 風, 商店街" />
        </label>
        <p className="coords">
          lat: {selected?.lat ?? "未選択"} / lng: {selected?.lng ?? "未選択"}
        </p>
        {error ? <p className="error">{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}
        <button className="primaryBtn" type="submit" disabled={isSaving || !selected}>
          {isSaving ? "保存中..." : "保存"}
        </button>
      </form>
    </section>
  );
}
