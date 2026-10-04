import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "walker@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const memo = { id: "22222222-2222-4222-8222-222222222222", user_id: user.id, title: "保存済みの道", body: "以前のメモ", tags: [], lat: 35, lng: 139, version: 1, created_at: "2026-10-04T00:00:00Z", updated_at: "2026-10-04T00:00:00Z" };
async function auth(page: Page) {
  await page.route("https://test-project.supabase.co/auth/v1/**", route => route.fulfill({ json: route.request().url().includes("/token") ? { access_token: "test-token", refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, user } : { user } }));
  await page.goto("/");
  await page.getByLabel("メールアドレス").fill(user.email);
  await page.getByLabel("パスワード", { exact: true }).fill("walking-password");
  await page.getByRole("button", { name: "ログインする", exact: true }).click();
}
test("lost save response retries same operation without duplicates", async ({ page }) => {
  let posts = 0; const ids: string[] = []; let saved = false;
  await page.route("**/api/memos**", route => {
    const request = route.request();
    if (request.method() === "GET") return route.fulfill({ json: { items: saved ? [memo] : [], nextCursor: null } });
    ids.push(request.headers()["idempotency-key"]); posts++; saved = true;
    if (posts === 1) return route.abort();
    return route.fulfill({ json: memo });
  });
  await auth(page);
  await page.getByText("緯度・経度で選ぶ", { exact: true }).click();
  await page.getByRole("button", { name: "この座標を選ぶ" }).click();
  await page.getByLabel("本文（必須）").fill("失いたくない入力");
  await page.getByRole("button", { name: "メモを保存", exact: true }).click();
  await expect(page.getByText(/通信を確認できませんでした/)).toBeVisible();
  await expect(page.getByLabel("本文（必須）")).toHaveValue("失いたくない入力");
  await page.getByRole("button", { name: "メモを保存", exact: true }).click();
  await expect(page.locator(".memoItem")).toHaveCount(1);
  expect(ids).toHaveLength(2); expect(ids[0]).toBeTruthy(); expect(ids[0]).toBe(ids[1]);
});
test("conflicting edit retains input and cancelled navigation keeps draft", async ({ page }) => {
  await page.route("**/api/memos**", route => route.request().method() === "GET" ? route.fulfill({ json: { items: [memo], nextCursor: null } }) : route.fulfill({ status: 409, json: { error: "別の画面で更新されました。" } }));
  await auth(page);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await page.getByLabel("本文（必須）").fill("編集中の大切な内容");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.getByText("別の画面で更新されました。")).toBeVisible();
  await expect(page.getByLabel("本文（必須）")).toHaveValue("編集中の大切な内容");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "編集をやめる" }).click();
  await expect(page.getByLabel("本文（必須）")).toHaveValue("編集中の大切な内容");
});
test("pagination appends and search queries the full dataset", async ({ page }) => {
  await page.route("**/api/memos**", route => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: params.has("q") && params.get("q") ? { items: [{ ...memo, id: "found", title: "未取得ページの検索結果" }], nextCursor: null } : params.has("cursor") ? { items: [{ ...memo, id: "second", title: "次のページ" }], nextCursor: null } : { items: [memo], nextCursor: "next-page" } });
  });
  await auth(page);
  await page.getByRole("button", { name: "さらに50件を読み込む" }).click();
  await expect(page.locator(".memoItem")).toHaveCount(2);
  await page.getByLabel("メモを検索").fill("未取得");
  await expect(page.locator(".memoItem")).toHaveCount(1);
  await expect(page.locator(".memoItem")).toContainText("未取得ページの検索結果");
});
test("password recovery request and invalid recovery page", async ({ page }) => {
  await page.route("https://test-project.supabase.co/auth/v1/recover**", route => route.fulfill({ json: {} }));
  await page.goto("/");
  await page.getByRole("button", { name: "パスワードを忘れた方" }).click();
  await page.getByLabel("メールアドレス").fill(user.email);
  await page.getByRole("button", { name: "再設定メールを送る" }).click();
  await expect(page.getByRole("status")).toContainText("再設定メールが届きます");
  await page.goto("/auth/reset");
  await expect(page.getByText(/リンクが無効か期限切れ/)).toBeVisible();
});
test("legacy Maps configuration cannot enable Google", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("button", { name: "Google Mapsを表示" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "デモ地図で場所を選ぶ" })).toBeVisible();
  await page.getByLabel("メモを検索").fill("路地");
  await expect(page.locator(".memoItem")).toHaveCount(1);
  // The automatic fixture checks all requests and blocks paid endpoints.
});
test("registration validates password confirmation before sending", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "false", "Personal deployment disables signups");
  let signups = 0;
  await page.route("https://test-project.supabase.co/auth/v1/signup**", route => { signups++; return route.fulfill({ json: { user, session: null } }); });
  await page.goto("/");
  await page.getByRole("button", { name: "新規登録", exact: true }).click();
  await page.getByLabel("メールアドレス").fill(user.email);
  await page.getByLabel("パスワード", { exact: true }).fill("test-password-one");
  await page.getByLabel("パスワードの確認", { exact: true }).fill("test-password-two");
  await page.getByRole("button", { name: "アカウントを作る" }).click();
  await expect(page.getByRole("status")).toContainText("パスワードが一致しません");
  expect(signups).toBe(0);
  await page.getByLabel("パスワードの確認", { exact: true }).fill("test-password-one");
  await page.getByRole("button", { name: "アカウントを作る" }).click();
  await expect(page.getByRole("status")).toContainText("確認メールを送りました");
  expect(signups).toBe(1);
});
test("personal deployment offers login without registration", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_ALLOW_SIGNUP !== "false", "Run with NEXT_PUBLIC_ALLOW_SIGNUP=false");
  await page.goto("/");
  await expect(page.getByRole("button", { name: "新規登録", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ログインする", exact: true })).toBeVisible();
  await expect(page.getByText(/新規登録は受け付けていません/)).toBeVisible();
});
test("authenticated password update handles mismatch and success", async ({ page }) => {
  let updates = 0;
  await page.route("**/api/memos**", route => route.fulfill({ json: { items: [], nextCursor: null } }));
  await auth(page);
  await page.route("https://test-project.supabase.co/auth/v1/user", route => { if (route.request().method() === "PUT") updates++; return route.fulfill({ json: user }); });
  await page.goto("/auth/reset");
  await page.getByLabel("新しいパスワード", { exact: true }).fill("updated-password");
  await page.getByLabel("新しいパスワードの確認").fill("different-password");
  await page.getByRole("button", { name: "パスワードを更新" }).click();
  await expect(page.getByRole("status")).toContainText("一致しません");
  expect(updates).toBe(0);
  await page.getByLabel("新しいパスワードの確認").fill("updated-password");
  await page.getByRole("button", { name: "パスワードを更新" }).click();
  await expect(page.getByRole("status")).toContainText("パスワードを更新しました");
  expect(updates).toBe(1);
});
test("deployment headers and unauthenticated API do not expose data", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  const privateResponse = await request.get("/api/memos");
  expect(privateResponse.status()).toBe(401);
  expect(privateResponse.headers()["cache-control"]).toContain("no-store");
});
