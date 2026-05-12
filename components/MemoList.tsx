"use client";

import { useMemo, useState } from "react";
import type { Memo } from "@/types/memo";

type MemoListProps = { memos: Memo[] };

function formatMonth(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "不明";
  }

  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export function MemoList({ memos }: MemoListProps) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const tags = useMemo(() => {
    const counter = new Map<string, number>();
    memos.forEach((memo) => {
      memo.tags.forEach((tag) => {
        counter.set(tag, (counter.get(tag) ?? 0) + 1);
      });
    });

    return Array.from(counter.entries()).sort((a, b) => b[1] - a[1]);
  }, [memos]);

  const monthlyCounts = useMemo(() => {
    const counter = new Map<string, number>();
    memos.forEach((memo) => {
      const month = formatMonth(memo.created_at);
      counter.set(month, (counter.get(month) ?? 0) + 1);
    });

    return Array.from(counter.entries());
  }, [memos]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredMemos = useMemo(() => {
    return memos.filter((memo) => {
      const text = `${memo.title ?? ""} ${memo.body} ${memo.tags.join(" ")}`.toLowerCase();
      const matchQuery = !normalizedQuery || text.includes(normalizedQuery);
      const matchTag = !activeTag || memo.tags.includes(activeTag);
      return matchQuery && matchTag;
    });
  }, [activeTag, memos, normalizedQuery]);

  return (
    <section className="card">
      <h2>散歩ノート</h2>
      <p className="subtle">検索・タグ・月別ふりかえりで、記録の蓄積が価値になる状態をつくる。</p>

      <div className="memoTools">
        <label>
          メモ検索
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例: カフェ / 桜 / 静か"
          />
        </label>

        <div>
          <p className="subtle">タグで絞り込み</p>
          <div className="tagGroup">
            <button type="button" onClick={() => setActiveTag(null)} className={!activeTag ? "activeTag" : ""}>
              すべて
            </button>
            {tags.map(([tag, count]) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(tag)}
                className={activeTag === tag ? "activeTag" : ""}
              >
                #{tag} ({count})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="statsGrid">
        <div className="statCard">
          <strong>{memos.length}</strong>
          <span>総メモ数</span>
        </div>
        <div className="statCard">
          <strong>{tags.length}</strong>
          <span>ユニークタグ</span>
        </div>
        <div className="statCard">
          <strong>{monthlyCounts.length}</strong>
          <span>記録した月</span>
        </div>
      </div>

      {monthlyCounts.length > 0 ? (
        <ul className="monthList">
          {monthlyCounts.map(([month, count]) => (
            <li key={month}>
              {month}: {count}件
            </li>
          ))}
        </ul>
      ) : null}

      {filteredMemos.length === 0 ? (
        <p>該当するメモがありません。</p>
      ) : (
        <ul className="memoList">
          {filteredMemos.map((memo) => (
            <li key={memo.id}>
              <strong>{memo.title || "（無題）"}</strong>
              <p>{memo.body}</p>
              <small>
                {memo.lat.toFixed(5)}, {memo.lng.toFixed(5)} / {memo.tags.join(" / ")}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
