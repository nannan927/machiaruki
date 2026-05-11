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
      <h1>Machinote MVP1</h1>
      <p>街の上に、自分の言葉を置くための最小実装です。</p>
      {error ? <p className="error">{error}</p> : null}

      <MapView selected={selected} memos={memos} onSelect={setSelected} />
      <MemoForm selected={selected} onSaved={fetchMemos} />
      <MemoList memos={memos} />
    </main>
  );
}
