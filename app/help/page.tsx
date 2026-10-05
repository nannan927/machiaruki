import Link from "next/link";
import { NotebookHelp } from "@/components/NotebookHelp";

export default function HelpPage() {
  return <main className="container appRoot helpPage"><Link href="/">‹ 地図の余白へ</Link><h1>使い方・よくある質問</h1><NotebookHelp /><Link href="/guest">登録せずに使う</Link></main>;
}
