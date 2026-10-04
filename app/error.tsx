"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="container appRoot"><section className="card"><h1>画面を表示できませんでした</h1><p>接続を確認して、もう一度お試しください。</p><button onClick={reset}>再試行</button></section></main>;
}
