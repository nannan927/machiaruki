import type { Memo } from "../types/memo";
export function filterMemos(memos: Memo[], query: string) {
  const terms = query.normalize("NFKC").toLocaleLowerCase("ja").trim().split(/\s+/).filter(Boolean);
  return memos.filter(memo => {
    const text = [memo.title ?? "", memo.body, ...memo.tags].join(" ").normalize("NFKC").toLocaleLowerCase("ja");
    return terms.every(term => text.includes(term));
  });
}
