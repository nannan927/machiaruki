"use client";
import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase";
type Mode = "login" | "signup" | "reset";
const signupEnabled = process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true";
export function AuthPanel() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const client = getBrowserClient();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!client || busy) return;
    if (mode === "signup" && !signupEnabled) return;
    if (mode === "signup" && password !== confirmation) { setMessage("パスワードが一致しません。"); return; }
    setBusy(true); setMessage("");
    try {
      if (mode === "reset") {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/reset` });
        setMessage(error ? "送信できませんでした。時間を置いてお試しください。" : "登録されているアドレスであれば再設定メールが届きます。メールのリンクを開いてください。");
      } else {
        const result = mode === "login" ? await client.auth.signInWithPassword({ email: email.trim(), password }) : await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
        if (result.error) setMessage(mode === "login" ? "ログインできませんでした。メールアドレス・パスワード・メール認証を確認してください。" : "登録できませんでした。入力内容を確認し、時間を置いてお試しください。");
        else if (mode === "signup" && !result.data.session) { setPassword(""); setConfirmation(""); setMessage("確認メールを送りました。メール内のリンクを開いてからログインしてください。"); }
      }
    } catch { setMessage("接続できませんでした。時間を置いてお試しください。"); }
    finally { setBusy(false); }
  }
  function changeMode(value: Mode) { setMode(value); setMessage(""); setPassword(""); setConfirmation(""); }
  return <section className="card authCard">
    <h2>自分だけの散歩ノート</h2><p>ログインして、見つけた景色や気づきを場所と一緒に残しましょう。</p>
    {!client ? <p role="alert" className="error">保存先が未設定です。管理者が接続設定を行うと利用できます。</p> : <>
      <div className="memoTools"><button type="button" disabled={busy} aria-pressed={mode === "login"} onClick={() => changeMode("login")}>ログイン</button>{signupEnabled && <button type="button" disabled={busy} aria-pressed={mode === "signup"} onClick={() => changeMode("signup")}>新規登録</button>}</div>
      {!signupEnabled && <p>登録済みのアカウントでログインしてください。新規登録は受け付けていません。</p>}
      <form className="form" onSubmit={submit}><fieldset disabled={busy}>
        <label>メールアドレス<input type="email" autoComplete="email" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} /></label>
        {mode !== "reset" && <label>パスワード<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : undefined} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /></label>}
        {mode === "signup" && <><label>パスワードの確認<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label><small>パスワードは8文字以上で入力してください。</small></>}
        <button className="primaryBtn" disabled={busy}>{busy ? "接続中…" : mode === "login" ? "ログインする" : mode === "signup" ? "アカウントを作る" : "再設定メールを送る"}</button>
        <p role="status">{message}</p>
      </fieldset></form>
      {mode !== "reset" && <button type="button" disabled={busy} onClick={() => changeMode("reset")}>パスワードを忘れた方</button>}
    </>}
  </section>;
}
