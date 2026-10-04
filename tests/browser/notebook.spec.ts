import { test, expect } from "./fixtures";

test("login, location, create, search, edit, delete, logout on mobile", async ({ page }) => {
  page.on("pageerror", error => { console.error(error.message); });
  await page.setViewportSize({ width: 390, height: 844 });
  const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "walker@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  await page.route("https://test-project.supabase.co/auth/v1/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(route.request().url().includes("/token") ? { access_token: "test-token", refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, user } : { user }) }));
  let memos: Record<string, unknown>[] = [];
  await page.route("**/api/memos**", async route => {
    const request = route.request();
    expect(request.headers().authorization).toBe("Bearer test-token");
    if (request.method() === "GET") {
      const terms = (new URL(request.url()).searchParams.get("q") ?? "").split(/\s+/).filter(Boolean);
      return route.fulfill({ json: { items: memos.filter(memo => terms.every(term => JSON.stringify(memo).includes(term))), nextCursor: null } });
    }
    if (request.method() === "DELETE") { memos = []; return route.fulfill({ status: 204 }); }
    const memo = { ...request.postDataJSON(), id: "22222222-2222-4222-8222-222222222222", version: 1, user_id: user.id, created_at: "2026-10-04T00:00:00Z", updated_at: "2026-10-04T00:00:00Z" };
    memos = [memo];
    return route.fulfill({ status: request.method() === "POST" ? 201 : 200, json: memo });
  });
  await page.goto("/classic");
  await page.getByLabel("メールアドレス").fill("walker@example.com");
  await page.getByLabel("パスワード").fill("walking-password");
  await page.getByRole("button", { name: "ログインする", exact: true }).click();
  await expect(page.getByRole("region", { name: "メモの地図" })).toBeVisible();
  await page.evaluate(() => Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (success: (position: unknown) => void) => success({ coords: { latitude: 35.5, longitude: 139.5 } }) } }));
  await page.getByRole("button", { name: "現在地を選ぶ" }).click();
  await expect(page.getByText("選択中: 35.50000, 139.50000")).toBeVisible();
  await page.evaluate(() => Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (_success: unknown, failure: (error: unknown) => void) => failure({ code: 1 }) } }));
  await page.getByRole("button", { name: "現在地を選ぶ" }).click();
  await expect(page.getByText("位置情報が許可されていません", { exact: false })).toBeVisible();
  await page.getByText("緯度・経度で選ぶ", { exact: true }).click();
  await page.getByLabel("緯度", { exact: true }).fill("35.681");
  await page.getByLabel("経度", { exact: true }).fill("139.767");
  await page.getByRole("button", { name: "この座標を選ぶ" }).click();
  await page.getByLabel("タイトル", { exact: true }).fill("夕陽の路地");
  await page.getByLabel("本文（必須）").fill("風が気持ちいい");
  await page.getByLabel("タグ（カンマ区切り・10個まで）").fill("散歩, 風");
  await page.getByRole("button", { name: "メモを保存", exact: true }).click();
  await expect(page.locator(".memoItem")).toHaveCount(1);
  await page.screenshot({ path: "/tmp/machiaruki-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "/tmp/machiaruki-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator(".memoItem")).toHaveCount(1);
  await page.getByLabel("メモを検索").fill("海");
  await expect(page.getByText("条件に合うメモがありません。")).toBeVisible();
  await page.getByLabel("メモを検索").fill("夕陽 風");
  await expect(page.locator(".memoItem")).toHaveCount(1);
  await page.getByRole("button", { name: "編集", exact: true }).click();
  await page.getByLabel("本文（必須）").fill("また歩きたい道");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.locator(".memoItem")).toContainText("また歩きたい道");
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(page.locator(".memoItem")).toHaveCount(1);
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await expect(page.locator(".memoItem")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "ログアウト", exact: true }).click();
  await expect(page.getByRole("button", { name: "ログインする", exact: true })).toBeVisible();
});
