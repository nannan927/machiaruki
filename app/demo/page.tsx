import Link from "next/link";
import { Notebook } from "@/components/Notebook";
export default function DemoPage() {
  return <main className="container appRoot demoRoot">
    <header className="hero"><p className="eyebrow">いつもの道に、小さな発見を。</p><h1>地図の余白</h1><p className="lead">街の余白に、わたしの視点を残す。</p></header>
    <aside className="demoBanner"><div><strong>おためし散歩</strong><p>ログイン不要。地図の好きな場所を押して、気づきを残してみましょう。</p><small>メモはこのブラウザーに保存されます。最初の3件は架空のサンプルです。</small></div><Link href="/">ログイン画面へ →</Link></aside>
    <Notebook demo />
  </main>;
}
