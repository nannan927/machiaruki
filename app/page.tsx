"use client";

import { useCallback, useEffect, useState } from "react";
import { MapView } from "@/components/MapView";
import { MemoForm } from "@/components/MemoForm";
import { MemoList } from "@/components/MemoList";
import type { Memo } from "@/types/memo";

async function loadMemos() {
  const response = await fetch("/api/memos");
  if (!response.ok) {
    throw new Error("Failed to fetch memos");
  }

  return (await response.json()) as Memo[];
}

export default function Home() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [selected, setSelected] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMemos = useCallback(async () => {
    try {
      const data = await loadMemos();
      setMemos(data);
      setError(null);
    } catch {
      setError("メモの取得に失敗しました。Supabase設定を確認してください。");
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    loadMemos()
      .then((data) => {
        if (!ignore) {
          setMemos(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!ignore) {
          setError("メモの取得に失敗しました。Supabase設定を確認してください。");
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <main className="container">
      <section className="hero card">
        <p className="eyebrow">Machinote MVP1</p>
        <h1>その場所で感じたことを、3ステップで記録。</h1>
        <p>
          まず地図で場所を選び、次に短くメモして保存。歩いた軌跡があなたの街のノートになります。
        </p>
        <ol className="steps">
          <li>地図で「ここだ」と思う地点を選ぶ</li>
          <li>感じたことをひとこと書く</li>
          <li>この場所に保存して一覧で振り返る</li>
        </ol>
      </section>
      {error ? <p className="error">{error}</p> : null}

      <MapView selected={selected} memos={memos} onSelect={setSelected} />
      <MemoForm selected={selected} onSaved={fetchMemos} />
      <MemoList memos={memos} />
    </main>
  );
}
