import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import type { Memo } from "../../types/memo";
const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "walker@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const old: Memo = { id: "22222222-2222-4222-8222-222222222222", user_id: user.id, title: null, body: "去年この場所で見つけた花", lat: 36.7411, lng: 137.0154, tags: [], version: 1, created_at: "2025-04-01T09:00:00Z", updated_at: "2025-04-01T09:00:00Z" };
async function setup(page: Page, initial: Memo[] = []) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("https://test-project.supabase.co/auth/v1/**", route => route.fulfill({ json: route.request().url().includes("/token") ? { access_token: "test-token", refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, user } : { user } }));
  const state = { memos: [...initial], lost: false, posts: 0, mapReads: 0 };
  await page.route("**/api/memos**", route => {
    const r = route.request(); const u = new URL(r.url());
    if (r.method() === "GET") {
      if (u.pathname.endsWith("/map")) { state.mapReads++; return route.fulfill({ json: { items: state.memos, truncated: false } }); }
      if (u.pathname === "/api/memos") return route.fulfill({ json: { items: state.memos.filter(m => m.body.includes(u.searchParams.get("q") ?? "")), nextCursor: null } });
      const memo = state.memos.find(m => u.pathname.endsWith(m.id)); return route.fulfill({ status: memo ? 200 : 404, json: memo ?? { error: "missing" } });
    }
    if (r.method() === "DELETE") { state.memos = state.memos.filter(m => !u.pathname.endsWith(m.id)); return route.fulfill({ status: 204 }); }
    const previous = state.memos.find(m => u.pathname.endsWith(m.id));
    const memo = { ...r.postDataJSON(), id: previous?.id ?? r.headers()["idempotency-key"], user_id: user.id, version: (previous?.version ?? 0) + 1, created_at: previous?.created_at ?? new Date().toISOString(), updated_at: new Date().toISOString() };
    if (r.method() === "POST") state.posts++;
    state.memos = [memo, ...state.memos.filter(m => m.id !== memo.id)];
    if (state.lost) { state.lost = false; return route.abort(); }
    return route.fulfill({ json: memo });
  });
  await page.goto("/"); await page.getByLabel("メールアドレス").fill(user.email); await page.getByLabel("パスワード", { exact: true }).fill("walking-password"); await page.getByRole("button", { name: "ログインする", exact: true }).click();
  await expect(page.getByRole("button", { name: "書く", exact: true })).toBeEnabled();
  await expect(page.getByRole("region", { name: "思い出の地図" })).toBeVisible();
  return state;
}
async function chooseCenter(page: Page) { await page.getByRole("button", { name: "地図の中央を選ぶ", exact: true }).click(); }
async function persist(page: Page) { await expect(page.getByRole("status").filter({ hasText: "下書きを端末に保存しました" })).toBeVisible(); }
test("write before choosing a place, restore after reload, then read by day", async ({ page }) => {
  const state = await setup(page);
  await page.getByRole("button", { name: "書く", exact: true }).click();
  await page.getByLabel("この場所で何を見つけましたか？").fill("パン屋の前、甘い匂い。"); await persist(page);
  await expect(page.getByRole("button", { name: "この場所に保存", exact: true })).toBeDisabled();
  await page.reload(); await page.getByRole("button", { name: "続きを書く", exact: true }).click();
  await expect(page.getByLabel("この場所で何を見つけましたか？")).toHaveValue("パン屋の前、甘い匂い。");
  await page.getByRole("button", { name: "地図で場所を選ぶ", exact: true }).click(); await chooseCenter(page);
  await page.getByRole("button", { name: "この場所に保存", exact: true }).click();
  await expect(page.getByText("保存しました。言葉がこの場所に残りました。", { exact: true })).toBeVisible();
  expect(state.posts).toBe(1);
  await page.getByRole("button", { name: "ノート", exact: true }).click();
  await expect(page.getByRole("heading", { name: /今日の散歩/ })).toBeVisible();
  await page.locator(".memoryCard").click(); await expect(page.getByRole("dialog", { name: "場所に残した言葉" })).toBeVisible();
  await expect(page.getByLabel("この場所で何を見つけましたか？")).toHaveCount(0);
  await page.getByRole("button", { name: "編集する", exact: true }).click();
  await page.getByLabel("この場所で何を見つけましたか？").fill("もう一度来たいパン屋"); await page.getByRole("button", { name: "この場所に保存", exact: true }).click();
  await expect(page.locator(".memoryCard")).toContainText("もう一度来たいパン屋");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/machiaruki-walking-notes.png", fullPage: true });
  await page.locator(".memoryCard").click(); page.once("dialog", d => d.accept()); await page.getByRole("button", { name: "削除する", exact: true }).click();
  await expect(page.getByText("メモを削除しました。", { exact: true })).toBeVisible(); expect(state.memos).toHaveLength(0);
});
test("uncertain create persists operation across reload and reconciles without duplicate", async ({ page }) => {
  const state = await setup(page); state.lost = true;
  await chooseCenter(page); await page.getByRole("button", { name: "ここに残す", exact: true }).click();
  await page.getByLabel("この場所で何を見つけましたか？").fill("通信が途切れても残す言葉");
  await page.getByRole("button", { name: "この場所に保存", exact: true }).click(); await expect(page.locator(".walkingNotebook").getByRole("alert")).toContainText("通信を確認できません");
  await page.reload(); await page.getByRole("button", { name: "続きを書く", exact: true }).click();
  await expect(page.getByLabel("この場所で何を見つけましたか？")).toBeDisabled();
  await page.getByRole("button", { name: "結果を確認して再試行", exact: true }).click();
  await expect(page.getByText("保存しました。言葉がこの場所に残りました。", { exact: true })).toBeVisible(); expect(state.posts).toBe(1);
});
test("old map records are independent of first list page and open for reading", async ({ page }) => {
  const state = await setup(page, [old]);
  await expect(page.getByRole("button", { name: old.body, exact: true })).toBeVisible(); expect(state.mapReads).toBeGreaterThan(0);
  await page.getByRole("button", { name: old.body, exact: true }).click();
  await expect(page.locator(".memoryDetail")).toContainText(old.body);
  await expect(page.getByLabel("この場所で何を見つけましたか？")).toHaveCount(0);
});
test("dense map locations group records and user can read each memory", async ({ page }) => {
  await setup(page, [old, { ...old, id: "33333333-3333-4333-8333-333333333333", body: "夏、この場所だけ涼しい" }]);
  await page.getByRole("button", { name: "この場所に2つの記録", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "この場所の2つの記録" })).toBeVisible();
  await expect(page.locator(".walkingSheet .memoryCard")).toHaveCount(2);
  await page.locator(".walkingSheet .memoryCard").last().click(); await expect(page.locator(".memoryDetail")).toContainText("夏、この場所だけ涼しい");
});
test("location rejection preserves words; manual selection and logout clear private draft", async ({ page }) => {
  await setup(page);
  await page.evaluate(() => Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (_ok: unknown, fail: (err: unknown) => void) => fail({ code: 1 }) } }));
  await page.getByRole("button", { name: "書く", exact: true }).click(); await page.getByLabel("この場所で何を見つけましたか？").fill("位置情報がなくても書ける"); await persist(page);
  await page.getByRole("button", { name: "現在地を使う", exact: true }).click(); await expect(page.locator(".walkingNotebook").getByRole("alert")).toContainText("位置情報が許可されていません");
  await expect(page.getByLabel("この場所で何を見つけましたか？")).toHaveValue("位置情報がなくても書ける");
  await page.getByRole("button", { name: "下書きのまま閉じる", exact: true }).click(); await page.getByText("アカウント", { exact: true }).click(); page.once("dialog", d => d.accept()); await page.getByRole("button", { name: "ログアウト", exact: true }).click();
  await expect(page.getByRole("button", { name: "ログインする", exact: true })).toBeVisible();
  const saved = await page.evaluate(() => new Promise(resolve => { const db = indexedDB.open("machinote-private-drafts", 1); db.onsuccess = () => { const req = db.result.transaction("drafts").objectStore("drafts").getAll(); req.onsuccess = () => { resolve(req.result); db.result.close(); }; }; }));
  expect(saved).toEqual([]);
});
test("map home fits a phone and retains a draft while browsing", async ({ page }) => {
  await setup(page, [old]);
  await page.screenshot({ path: "/tmp/machiaruki-walking-map.png", fullPage: true });
  await page.getByRole("button", { name: "書く", exact: true }).click(); await page.getByLabel("この場所で何を見つけましたか？").fill("あとで場所を選ぶ"); await persist(page);
  await page.screenshot({ path: "/tmp/machiaruki-walking-write.png", fullPage: true });
  await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.getByRole("button", { name: old.body, exact: true }).click(); await page.getByRole("button", { name: "編集する", exact: true }).click(); await expect(page.locator(".walkingNotebook").getByRole("alert")).toContainText("書きかけの下書き");
  await page.getByRole("button", { name: "閉じる", exact: true }).click(); await page.getByRole("button", { name: "続きを書く", exact: true }).click(); await expect(page.getByLabel("この場所で何を見つけましたか？")).toHaveValue("あとで場所を選ぶ");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("a second tab cannot overwrite the first tab's draft", async ({ page, context }) => {
  await setup(page); await page.getByRole("button", { name: "書く", exact: true }).click(); await page.getByLabel("この場所で何を見つけましたか？").fill("最初のタブの言葉"); await persist(page);
  const second = await context.newPage();
  await second.route("https://test-project.supabase.co/auth/v1/**", route => route.fulfill({ json: { user } }));
  await second.route("**/api/memos**", route => route.fulfill({ json: { items: [], nextCursor: null, truncated: false } }));
  await second.goto("/"); await expect(second.getByText(/別のタブで記録を編集中/)).toBeVisible(); await expect(second.getByRole("button", { name: "書く", exact: true })).toBeDisabled();
  await page.close(); await second.reload(); await second.getByRole("button", { name: "続きを書く", exact: true }).click(); await expect(second.getByLabel("この場所で何を見つけましたか？")).toHaveValue("最初のタブの言葉");
});
test("storage failure is explicit and does not erase current words", async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { IDBObjectStore.prototype.put = () => { throw new DOMException("quota", "QuotaExceededError"); }; });
  await page.getByRole("button", { name: "書く", exact: true }).click(); await page.getByLabel("この場所で何を見つけましたか？").fill("端末がいっぱいでも消えない入力");
  await expect(page.getByRole("status").filter({ hasText: "端末に下書きを保存できません" })).toBeVisible(); await expect(page.getByLabel("この場所で何を見つけましたか？")).toHaveValue("端末がいっぱいでも消えない入力");
});
test("map finds an old memo excluded from first 50 notes, export includes every page", async ({ page }) => {
  await setup(page, [old]);
  const recent = Array.from({ length: 50 }, (_, i) => ({ ...old, id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, body: `新しい記録${i}`, created_at: "2026-10-04T09:00:00Z" }));
  await page.route("**/api/memos?*", route => { const url = new URL(route.request().url()); return route.fulfill({ json: url.searchParams.has("cursor") ? { items: [old], nextCursor: null } : { items: recent, nextCursor: "older" } }); });
  await page.route("**/api/memos", route => route.fulfill({ json: { items: recent, nextCursor: "older" } }));
  await page.getByRole("button", { name: "ノート", exact: true }).click(); await expect(page.locator(".dayGroup .memoryCard")).toHaveCount(50);
  await expect(page.locator(".walkingNotes")).not.toContainText(old.body);
  await page.getByRole("button", { name: "地図", exact: true }).click(); await page.getByRole("button", { name: old.body, exact: true }).click(); await expect(page.locator(".memoryDetail")).toContainText(old.body); await page.getByRole("button", { name: "閉じる", exact: true }).click();
  await page.getByRole("button", { name: "ノート", exact: true }).click();
  const downloadEvent = page.waitForEvent("download"); await page.getByRole("button", { name: "すべての記録を書き出す（JSON）" }).click(); const download = await downloadEvent;
  const fs = await import("node:fs/promises"); const data = JSON.parse(await fs.readFile((await download.path())!, "utf8")); expect(data.count).toBe(51); expect(data.memos.some((m: Memo) => m.id === old.id)).toBe(true);
});
test("drafts are isolated by account and cannot appear for another owner", async ({ page }) => {
  await setup(page); await page.getByRole("button", { name: "書く", exact: true }).click(); await page.getByLabel("この場所で何を見つけましたか？").fill("本人だけの下書き"); await persist(page);
  await page.evaluate(() => { const k = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token")); if (!k) throw new Error("Missing test session"); const session = JSON.parse(localStorage.getItem(k)!); session.user.id = "44444444-4444-4444-8444-444444444444"; session.user.email = "second@example.com"; localStorage.setItem(k, JSON.stringify(session)); });
  await page.reload(); await expect(page.getByRole("button", { name: "書く", exact: true })).toBeEnabled(); await expect(page.getByRole("button", { name: "続きを書く", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "書く", exact: true }).click(); await expect(page.getByLabel("この場所で何を見つけましたか？")).toHaveValue("");
});
test("late GPS does not overwrite a manually chosen draft location", async ({ page }) => {
  await setup(page);
  await page.evaluate(() => Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (success: (position: unknown) => void) => { (window as unknown as { finishLocation: () => void }).finishLocation = () => success({ coords: { latitude: 35, longitude: 139, accuracy: 50 } }); } } }));
  await page.getByRole("button", { name: "書く", exact: true }).click(); await page.getByLabel("この場所で何を見つけましたか？").fill("自分で選んだ角"); await page.getByRole("button", { name: "現在地を使う", exact: true }).click();
  await page.getByRole("button", { name: "地図で場所を選ぶ", exact: true }).click(); await chooseCenter(page);
  const chosen = await page.locator(".placeConfirm small").textContent();
  await page.evaluate(() => (window as unknown as { finishLocation: () => void }).finishLocation());
  await expect(page.locator(".placeConfirm small")).toHaveText(chosen!);
  expect(chosen).not.toBe("35.00000, 139.00000");
});
