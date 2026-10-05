"use client";
import Link from "next/link";
import { NotebookSheet } from "./NotebookSheet";
import { NotebookHelp } from "./NotebookHelp";

export type MenuPanel = "menu" | "account" | "manage" | "download" | "help" | "about" | "legacy" | "delete-all";
const titles: Record<MenuPanel, string> = { menu: "設定・ヘルプ", account: "保存先・アカウント", manage: "記録の管理", download: "記録をダウンロード", help: "使い方・よくある質問", about: "地図の余白について", legacy: "以前のデモから取り込む", "delete-all": "このブラウザーの記録を削除" };
export function NotebookMenu({ panel, setPanel, local, editable, hasDraft, busy, exporting, error, message, accountContent, onExport, onClear, onCopy, onReload }: {
  panel: MenuPanel | null; setPanel: (panel: MenuPanel | null) => void; local: boolean; editable: boolean; hasDraft: boolean; busy: boolean; exporting: boolean;
  error: string; message: string; accountContent?: React.ReactNode; onExport: () => void; onClear: () => void; onCopy: () => void; onReload: () => void;
}) {
  const scope = local ? "この端末のブラウザーの記録" : "現在のアカウントの記録";
  const entry = (to: MenuPanel, subtitle?: string) => <button type="button" className="settingsRow" onClick={() => setPanel(to)}><span>{titles[to]}{subtitle && <small>{subtitle}</small>}</span><span aria-hidden="true">›</span></button>;
  const back = panel === "download" || panel === "legacy" || panel === "delete-all" ? "manage" : "menu";
  return <NotebookSheet open={panel !== null} title={titles[panel ?? "menu"]} close={() => { if (!busy && !exporting) setPanel(null); }} className="settingsSheet">
    {panel !== "menu" && <button type="button" className="settingsBack" disabled={busy || exporting} onClick={() => setPanel(back)}>‹ {titles[back]}</button>}
    <section hidden={panel !== "menu"}>
      <h3 className="settingsGroup">自分の記録</h3>{entry("account", local ? "この端末のブラウザー" : "ログイン中のアカウント")}{entry("manage", "ダウンロード・取り込み・削除")}
      <h3 className="settingsGroup">困ったときに</h3>{entry("help")}<button type="button" className="settingsRow" onClick={onReload}>記録を再読み込み<span aria-hidden="true">↻</span></button>
      <h3 className="settingsGroup">地図の余白について</h3>{entry("about")}
    </section>
    <section hidden={panel !== "account"} aria-label="保存先とアカウント">
      {local ? <><div className="settingsInset"><strong>この端末のブラウザー</strong><p>別の端末や別のブラウザーとは共有されません。閲覧データの削除や端末の故障で記録を失うことがあります。</p></div><h3>ほかの端末でも使う</h3><p>Googleでログインすると、確認した記録をアカウントへ引き継げます。</p><Link className="entryButton" href="/">ほかの端末でも使う・ログイン →</Link>{hasDraft && <p>書きかけはこのブラウザーに残ります。引き継ぐ前にメモを保存してください。</p>}</> : accountContent}
    </section>
    <section hidden={panel !== "manage"}><p className="menuIntro">{scope}</p>{entry("download", "言葉・場所・日時をファイルに残す")}{local && <>{entry("legacy", "元のデモはそのまま残ります")}<div className="settingsDanger"><button type="button" onClick={() => setPanel("delete-all")}>このブラウザーの記録を削除</button></div></>}</section>
    <section hidden={panel !== "download"}><p className="menuIntro">{scope}</p><div className="settingsInset"><p>記録の本文・場所・日時などを、ひとつのファイルにまとめます。</p><small>形式：JSON</small></div><p>ダウンロードしても、元の記録は残ります。</p><p className="menuIntro">アプリへの読み戻しには、まだ対応していません。ファイルには場所の情報も含まれます。</p><button type="button" className="primaryBtn" disabled={exporting || busy} onClick={onExport}>{exporting ? "ダウンロードを準備中…" : "ダウンロードする"}</button></section>
    <section hidden={panel !== "legacy"}><p>以前のデモで自分が書いた記録を、このブラウザーのノートにコピーします。架空のサンプルは除き、元のデモは残します。</p><button type="button" disabled={!editable || hasDraft} onClick={onCopy}>以前のデモで書いた記録をコピー</button>{hasDraft && <p>先に下書きを保存するか破棄してください。</p>}<p><Link href="/demo">以前のデモと記録を開く</Link></p></section>
    <section hidden={panel !== "delete-all"}><p>この端末のブラウザーの記録と下書きをすべて削除します。元に戻せません。</p><p>アカウントに引き継いだ記録と、以前のデモは残ります。必要な記録は先に引き継ぐかダウンロードしてください。</p><button type="button" className="dangerBtn" disabled={!editable} onClick={onClear}>このブラウザーの記録をすべて削除</button></section>
    <section hidden={panel !== "help"}><NotebookHelp /></section>
    <section hidden={panel !== "about"}><p className="aboutWords">街の余白に、<br />わたしの視点を残す。</p><p>写真に写らない匂いや気持ちも、短い言葉にして場所に残す、自分のための散歩ノートです。</p><p><Link href="/privacy">データの扱い・お問い合わせについて</Link></p><p><Link href="/demo">以前のデモと記録を開く</Link></p></section>
    {panel && message && <p role="status" className="success">{message}</p>}{panel && error && <p role="alert" className="error">{error}</p>}
  </NotebookSheet>;
}
