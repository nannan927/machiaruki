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
    <main className="container appRoot">
      <header className="hero">
        <p className="eyebrow">街と一緒に考えるアプリ</p>
        <h1>地図の余白</h1>
        <p className="lead">街の余白に、わたしの視点を残す。</p>
      </header>

      {error ? <p className="error card">{error}</p> : null}

      <section className="phoneGrid">
        <MapView selected={selected} memos={memos} onSelect={setSelected} />
        <MemoForm selected={selected} onSaved={fetchMemos} />
        <MemoList memos={memos} />
      </section>
    </main>
  );
}
