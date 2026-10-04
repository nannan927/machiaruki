import { test, expect, gsiTiles, tileBody } from "./fixtures";
import type { Page } from "@playwright/test";

async function realDemo(page: Page) {
  await page.goto("/demo");
  await page.getByRole("button", { name: "実際の地図で試す" }).click();
  await expect(page.getByRole("button", { name: "地図の中央を選ぶ" })).toBeEnabled();
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
}

test("real map locates, selects, saves safe labels, edits from keyboard and survives remount", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 35.6812, longitude: 139.7671, accuracy: 25 });
  let tiles = 0;
  page.on("request", request => { if (request.url().includes("/xyz/pale/")) tiles++; });
  await page.goto("/demo");
  await expect(page.locator(".demoMap")).toBeVisible();
  expect(tiles).toBe(0);
  await page.getByRole("button", { name: "実際の地図で試す" }).click();
  await expect(page.getByRole("button", { name: "地図の中央を選ぶ" })).toBeEnabled();
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "地理院タイル", exact: true })).toHaveAttribute("href", "https://maps.gsi.go.jp/development/ichiran.html");
  await expect(page.locator(".currentLocationMarker")).toHaveCount(0);
  await page.getByRole("button", { name: "縮小", exact: true }).click();
  await page.getByRole("button", { name: "現在地を選ぶ" }).click();
  await expect(page.getByText("選択中: 35.68120, 139.76710")).toBeVisible();
  await expect(page.getByText(/位置精度：約25m/)).toBeVisible();
  await expect(page.locator(".currentLocationMarker")).toHaveCount(1);
  await expect(page.locator(".locationAccuracy")).toHaveCount(1);
  await expect(page.locator(".leaflet-tile-loaded").first()).toHaveAttribute("src", /\/pale\/16\//);
  // Center selection verifies that location actually moved the map viewport.
  await page.getByRole("button", { name: "地図の中央を選ぶ" }).click();
  await expect(page.getByText("選択中: 35.68120, 139.76710")).toBeVisible();
  await page.getByRole("region", { name: "メモの地図" }).click({ position: { x: 210, y: 220 } });
  await expect(page.getByText("選択中: 35.68120, 139.76710")).toHaveCount(0);
  const title = '<img src=x onerror="window.mapXss=1">';
  await page.getByLabel("タイトル", { exact: true }).fill(title);
  await page.getByLabel("本文（必須）").fill("地図の上に残した言葉");
  await page.getByRole("button", { name: "メモを保存", exact: true }).click();
  await expect(page.locator(".memoMapLabel").filter({ hasText: title })).toHaveText(title);
  expect(await page.evaluate(() => "mapXss" in window)).toBe(false);
  await expect(page.locator(".memoMapLabel img")).toHaveCount(0);
  const pin = page.getByRole("button", { name: `${title}を開く`, exact: true });
  await pin.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("本文（必須）")).toHaveValue("地図の上に残した言葉");
  await page.getByLabel("タイトル", { exact: true }).fill("風の通る路地");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.locator(".memoMapLabel").filter({ hasText: "風の通る路地" })).toHaveCount(1);
  await page.getByRole("button", { name: "架空のデモ地図に戻る" }).click();
  await page.getByRole("button", { name: "実際の地図で試す" }).click();
  await expect(page.locator(".leaflet-control-zoom")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "風の通る路地を開く", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "拡大", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/machiaruki-leaflet-mobile.png", fullPage: true });
  await page.reload();
  await page.getByRole("button", { name: "実際の地図で試す" }).click();
  await page.getByLabel("メモを検索").fill("風の通る路地");
  await expect(page.locator(".memoMapMarker")).toHaveCount(1);
  await page.locator(".memoItem").getByRole("button", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await expect(page.locator(".memoMapMarker")).toHaveCount(0);
  expect(tiles).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("tile failure is recoverable and memo saving still works", async ({ page }) => {
  await page.route(gsiTiles, route => route.abort());
  await page.goto("/demo");
  await page.getByRole("button", { name: "実際の地図で試す" }).click();
  await expect(page.getByText(/背景地図を読み込めない部分/)).toBeVisible();
  await page.getByRole("button", { name: "地図の中央を選ぶ" }).click();
  await page.getByLabel("タイトル", { exact: true }).fill("通信が弱い場所");
  await page.getByLabel("本文（必須）").fill("背景がなくても保存できる");
  await page.getByRole("button", { name: "メモを保存", exact: true }).click();
  await expect(page.locator(".memoItem").first()).toContainText("背景がなくても保存できる");
  await page.route(gsiTiles, route => route.fulfill({ contentType: "image/svg+xml", body: tileBody }));
  await page.getByRole("button", { name: "地図を再読み込み" }).click();
  await expect(page.getByText(/背景地図を読み込めない部分/)).toHaveCount(0);
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible();
});

test("late geolocation cannot replace a newer manual selection", async ({ page }) => {
  await realDemo(page);
  await page.evaluate(() => Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
    getCurrentPosition: (success: (position: unknown) => void) => { (window as Window & { finishLocation?: () => void }).finishLocation = () => success({ coords: { latitude: 35, longitude: 139, accuracy: 30 } }); },
  } }));
  await page.getByRole("button", { name: "現在地を選ぶ" }).click();
  await expect(page.getByRole("button", { name: "現在地を取得中…" })).toBeDisabled();
  await page.getByText("緯度・経度で選ぶ", { exact: true }).click();
  await page.getByLabel("緯度", { exact: true }).fill("34.5");
  await page.getByLabel("経度", { exact: true }).fill("135.5");
  await page.getByRole("button", { name: "この座標を選ぶ" }).click();
  await page.evaluate(() => (window as Window & { finishLocation?: () => void }).finishLocation?.());
  await expect(page.getByText("選択中: 34.50000, 135.50000")).toBeVisible();
  await expect(page.getByRole("button", { name: "現在地を選ぶ" })).toBeEnabled();
  await expect(page.locator(".currentLocationMarker")).toHaveCount(0);
  // A selection made from the separate memo list also wins over a pending location.
  await page.getByRole("button", { name: "現在地を選ぶ" }).click();
  await page.locator(".memoItem").first().getByRole("button", { name: "地図へ", exact: true }).click();
  const selection = await page.locator("p.coords").filter({ hasText: "選択中:" }).textContent();
  await page.evaluate(() => (window as Window & { finishLocation?: () => void }).finishLocation?.());
  await expect(page.locator("p.coords").filter({ hasText: "選択中:" })).toHaveText(selection!);
  await expect(page.getByRole("button", { name: "現在地を選ぶ" })).toBeEnabled();
});

test("geolocation timeout retains the selected place and allows retry", async ({ page }) => {
  await realDemo(page);
  await page.getByRole("button", { name: "地図の中央を選ぶ" }).click();
  await page.evaluate(() => Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
    getCurrentPosition: (_success: unknown, failure: (error: unknown) => void) => failure({ code: 3 }),
  } }));
  await page.getByRole("button", { name: "現在地を選ぶ" }).click();
  await expect(page.getByText(/現在地を取得できませんでした/)).toBeVisible();
  await expect(page.getByText("選択中: 36.74110, 137.01540")).toBeVisible();
  await expect(page.getByRole("button", { name: "現在地を選ぶ" })).toBeEnabled();
});
