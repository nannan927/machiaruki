import Link from "next/link";
import { Notebook } from "@/components/Notebook";
export default function DemoPage() {
  return <main className="container appRoot demoRoot">
    <header className="hero"><p className="eyebrow">いつもの道に、小さな発見を。</p><h1>地図の余白</h1><p className="lead">街の余白に、わたしの視点を残す。</p></header>
    <aside className="demoBanner"><div><strong>おためし散歩（以前のデモ）</strong><p>これまでのデモと記録は、ここに残しています。</p><small>メモはこのブラウザーに保存されます。最初の3件は架空のサンプルです。普段の記録には、サンプルのない新しいノートをご利用ください。</small></div><Link href="/guest">登録せずに使う →</Link></aside>
    <Notebook demo />
  </main>;
}
