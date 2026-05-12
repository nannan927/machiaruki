import type { Memo } from "@/types/memo";

type MemoListProps = { memos: Memo[] };

export function MemoList({ memos }: MemoListProps) {
  return (
    <section className="card toneList">
      <div className="cardHeader">
        <h2>3. 散歩ノート</h2>
      </div>
      {memos.length === 0 ? (
        <p>まだメモがありません。</p>
      ) : (
        <ul className="memoList">
          {memos.map((memo) => (
            <li key={memo.id} className="memoItem">
              <strong>{memo.title || "（無題）"}</strong>
              <p>{memo.body}</p>
              <small>
                {memo.lat.toFixed(5)}, {memo.lng.toFixed(5)}
              </small>
              {memo.tags.length > 0 ? (
                <div className="tagGroup">
                  {memo.tags.map((tag) => (
                    <span className="tag" key={`${memo.id}-${tag}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
