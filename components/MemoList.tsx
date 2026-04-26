import type { Memo } from "@/types/memo";

type MemoListProps = { memos: Memo[] };

export function MemoList({ memos }: MemoListProps) {
  return (
    <section className="card">
      <h2>保存済みメモ一覧</h2>
      {memos.length === 0 ? (
        <p>まだメモがありません。</p>
      ) : (
        <ul className="memoList">
          {memos.map((memo) => (
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
