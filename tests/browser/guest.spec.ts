import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

async function writeGuest(page: Page, body = "夕方の路地にパンの香り") {
  await page.goto("/guest");
  await expect(page.getByRole("button", { name: "書く", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "場所を選ぶ", exact: true }).click(); await page.getByRole("button", { name: "地図の中央を選ぶ" }).click();
  await page.getByRole("button", { name: "書く", exact: true }).click();
  await page.getByLabel("この場所で何を見つけましたか？").fill(body);
  await page.getByRole("button", { name: "この場所に保存", exact: true }).click();
  await expect(page.getByText("このブラウザーに保存しました。", { exact: true })).toBeVisible();
}
test("home offers a clear guest entry and explains account storage", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "登録せずに、散歩の記録を残す" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "記録を引き継ぐ・ログイン" })).toBeVisible();
  await page.screenshot({ path: "/tmp/machiaruki-guest-entry.png", fullPage: true });
  await page.getByRole("link", { name: "登録せずに使う →", exact: true }).click();
  await expect(page).toHaveURL(/\/guest$/);
  await expect(page.getByRole("button", { name: "書く", exact: true })).toBeEnabled();
  await expect(page.getByText("保存先：このブラウザー", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "思い出の地図" })).toBeVisible();
  await page.screenshot({ path: "/tmp/machiaruki-guest-map.png", fullPage: true });
});
test("guest writes, reloads, edits and deletes locally without auth, sample data or server requests", async ({ page }) => {
  const remote: string[] = [];
  page.on("request", r => { if (r.url().includes("supabase.co") || r.url().includes("/api/memos")) remote.push(r.url()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await writeGuest(page);
  await page.reload();
  await page.getByRole("button", { name: "ノート", exact: true }).click();
  await expect(page.locator(".memoryCard")).toHaveCount(1);
  await page.locator(".memoryCard").click(); await page.getByRole("button", { name: "編集する" }).click();
  await page.getByLabel("この場所で何を見つけましたか？").fill("夕方の路地、また歩きたい");
  await page.getByRole("button", { name: "この場所に保存", exact: true }).click();
  await expect(page.locator(".memoryCard")).toContainText("また歩きたい");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/machiaruki-guest-notes.png", fullPage: true });
  await page.getByRole("button", { name: "メニュー", exact: true }).click(); await page.getByRole("button", { name: /記録の管理/ }).click();
  await page.getByRole("button", { name: "このブラウザーの記録を削除", exact: true }).click();
  page.once("dialog", d => d.dismiss());
  await page.getByRole("button", { name: "このブラウザーの記録をすべて削除" }).click();
  await expect(page.locator(".memoryCard")).toHaveCount(1);
  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: "このブラウザーの記録をすべて削除" }).click();
  await expect(page.getByText("このブラウザーの記録と下書きを削除しました。", { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole("button", { name: "ノート", exact: true }).click();
  await expect(page.locator(".memoryCard")).toHaveCount(0);
  expect(remote).toEqual([]);
});

test("legacy demo copies only personal records and preserves the original and its date", async ({ page }) => {
  await page.goto("/guest");
  const record = { id: "22222222-2222-4222-8222-222222222222", user_id: "demo", body: "以前のデモで書いた記録", title: null, tags: [], lat: 36.74, lng: 137.01, created_at: "2026-01-02T00:00:00Z", updated_at: "2026-01-02T00:00:00Z", version: 1 };
  const source = JSON.stringify([{ ...record, id: "sample-0", body: "架空のサンプル" }, record]);
  await page.evaluate(value => localStorage.setItem("machinote-demo-v1", value), source);
  await page.getByRole("button", { name: "ノート", exact: true }).click();
  await page.getByRole("button", { name: "メニュー", exact: true }).click(); await page.getByRole("button", { name: /記録の管理/ }).click();
  await page.getByRole("button", { name: /以前のデモから取り込む/ }).click();
  await page.getByRole("button", { name: "以前のデモで書いた記録をコピー" }).click();
  await expect(page.locator(".memoryCard")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: /2026\/1\/2/ })).toBeVisible();
  await page.getByRole("button", { name: "以前のデモで書いた記録をコピー" }).click();
  await expect(page.getByText("コピーする新しい記録はありません。サンプルは含めません。", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("machinote-demo-v1"))).toBe(source);
});

test("handoff requires account confirmation, retains originals and retries a lost response without duplicates", async ({ page }) => {
  await writeGuest(page);
  const user = { id: "11111111-1111-4111-8111-111111111111", email: "walker@example.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  await page.route("https://test-project.supabase.co/auth/v1/**", route => route.fulfill({ json: route.request().url().includes("/token") ? { access_token: "test-token", refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, user } : { user } }));
  const saved = new Map(); let posts = 0; const ids: string[] = [];
  await page.route("**/api/memos**", route => {
    const r = route.request();
    if (r.method() === "GET") return route.fulfill({ json: { items: [...saved.values()], nextCursor: null, truncated: false } });
    const id = r.headers()["idempotency-key"]; ids.push(id); posts++;
    expect(r.headers()["x-memo-created-at"]).toBeTruthy();
    const memo = { ...r.postDataJSON(), id, user_id: user.id, version: 1, created_at: r.headers()["x-memo-created-at"], updated_at: new Date().toISOString() };
    saved.set(id, memo);
    if (posts === 1) return route.abort();
    return route.fulfill({ json: memo });
  });
  await page.getByRole("button", { name: "保存先：このブラウザー", exact: false }).click();
  await page.getByRole("link", { name: "ほかの端末でも使う・ログイン →" }).click();
  await page.getByLabel("メールアドレス").fill(user.email); await page.getByLabel("パスワード", { exact: true }).fill("walking-password");
  await page.getByRole("button", { name: "ログインする", exact: true }).click();
  await page.getByRole("button", { name: /保存先：アカウント/ }).click();
  const panel = page.getByRole("region", { name: "端末の記録を引き継ぐ" });
  await expect(panel).toContainText(user.email);
  expect(posts).toBe(0);
  await panel.getByRole("button", { name: "記録を確認する" }).click();
  await expect(panel.getByRole("button", { name: "1件をこのアカウントに引き継ぐ" })).toBeDisabled();
  await panel.getByRole("checkbox").check();
  await panel.getByRole("button", { name: "1件をこのアカウントに引き継ぐ" }).click();
  await expect(panel.getByRole("alert")).toContainText("元の記録はこのブラウザーに残っています");
  await page.reload(); await page.getByRole("button", { name: /保存先：アカウント/ }).click(); await panel.getByRole("button", { name: "記録を確認する" }).click(); await panel.getByRole("checkbox").check();
  await panel.getByRole("button", { name: "1件をこのアカウントに引き継ぐ" }).click();
  await expect(panel.getByRole("status")).toContainText("1件を引き継ぎました");
  expect(saved.size).toBe(1); expect(ids[0]).toBe(ids[1]);
  await panel.getByRole("button", { name: "記録を確認する" }).click();
  await expect(panel.getByRole("status")).toContainText("引き継ぎは完了しています");
  expect(posts).toBe(2);
  await panel.getByRole("link", { name: "端末のノートを開く" }).click();
  await expect(page).toHaveURL(/\/guest$/);
  await page.getByRole("button", { name: "ノート", exact: true }).click();
  await expect(page.locator(".memoryCard")).toHaveCount(1);
});

test("a guest storage write failure keeps the draft and does not claim success", async ({ page }) => {
  await page.goto("/guest");
  await expect(page.getByRole("button", { name: "書く", exact: true })).toBeEnabled();
  await page.evaluate(() => { const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function(...args) { if (this.name === "memos") throw new DOMException("quota", "QuotaExceededError"); return put.apply(this, args); }; });
  await page.getByRole("button", { name: "場所を選ぶ", exact: true }).click(); await page.getByRole("button", { name: "地図の中央を選ぶ" }).click(); await page.getByRole("button", { name: "書く", exact: true }).click();
  await page.getByLabel("この場所で何を見つけましたか？").fill("消えてほしくない下書き");
  await page.getByRole("button", { name: "この場所に保存", exact: true }).click();
  await expect(page.locator(".walkingSheet").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("この場所で何を見つけましたか？")).toHaveValue("消えてほしくない下書き");
  await expect(page.getByText("このブラウザーに保存しました。", { exact: true })).toHaveCount(0);
});
