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
      setError("先に地図で場所を選択してください。");
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
    <section className="card">
      <h2>場所の記録を投稿</h2>
      <form onSubmit={handleSubmit} className="form">
        <label>
          タイトル
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例）駅前のベンチ"
          />
        </label>
        <label>
          本文*
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={4}
            placeholder="この場所で気づいたこと・記録したいこと"
          />
        </label>
        <label>
          タグ（カンマ区切り）
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="例）散歩,カフェ,静か"
          />
        </label>

        <p>lat: {selected?.lat ?? "未選択"}</p>
        <p>lng: {selected?.lng ?? "未選択"}</p>
        {!selected ? <p className="hint">地図をクリックして投稿先の場所を選択してください。</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {success ? <p className="success">{success}</p> : null}

        <button type="submit" disabled={isSaving || !selected}>
          {isSaving ? "保存中..." : "この場所に保存"}
        </button>
      </form>
    </section>
  );
}
