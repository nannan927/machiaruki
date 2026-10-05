import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

const records = ["角を曲がると、金木犀。", "パン屋の前、甘い匂い。", "川沿いのベンチ。"].map((body, i) => ({ id: `22222222-2222-4222-8222-22222222222${i}`, user_id: "browser-guest", title: null, body, tags: [], lat: 36.7411, lng: 137.0154, version: 1, created_at: `2026-10-0${5 - i}T07:00:00.000Z`, updated_at: "2026-10-05T07:00:00.000Z" }));
async function setup(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/guest");
  await expect(page.getByRole("button", { name: "書く", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "ノート", exact: true }).click();
  await expect(page.getByText("まだ記録がありません。短い一言から残してみましょう。", { exact: true })).toBeVisible();
  await page.evaluate(memos => new Promise<void>((resolve, reject) => {
    const req = indexedDB.open("machinote-guest", 1);
    req.onupgradeneeded = () => { req.result.createObjectStore("memos", { keyPath: "id" }); req.result.createObjectStore("imports", { keyPath: "key" }); };
    req.onsuccess = () => { const db = req.result; const tx = db.transaction("memos", "readwrite"); memos.forEach(m => tx.objectStore("memos").put(m)); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
    req.onerror = () => reject(req.error);
  }), records);
  await page.reload();
  await page.getByRole("button", { name: "説明を閉じる", exact: true }).click();
  await page.getByRole("button", { name: "ノート", exact: true }).click();
  await expect(page.locator(".dayGroup .memoryCard")).toHaveCount(3);
}
async function drag(page: Page, index: number, dx: number, dy = 0) {
  const card = page.locator(".dayGroup .memoryCard").nth(index);
  await card.scrollIntoViewIfNeeded();
  const b = (await card.boundingBox())!;
  const x = Math.max(25, b.x + b.width * .7), y = b.y + Math.min(40, b.height / 2);
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 12 }); await page.mouse.up();
}

test("swipe reveals one action without deleting; cancel restores focus; one confirmed record is removed", async ({ page, context }) => {
  await setup(page);
  const actions = page.locator(".swipeDelete:visible");
  await drag(page, 0, -20); await expect(actions).toHaveCount(0);
  await drag(page, 0, 4, 65); await expect(actions).toHaveCount(0); await expect(page.getByRole("dialog")).toHaveCount(0);
  await drag(page, 0, -130); await expect(actions).toHaveCount(1); await expect(page.locator(".dayGroup .memoryCard")).toHaveCount(3);
  await page.screenshot({ path: "/tmp/machiaruki-redesign-swipe.png", fullPage: true });
  await drag(page, 1, -100); await expect(actions).toHaveCount(1); await expect(actions).toHaveAttribute("aria-label", /パン屋/);
  await actions.click();
  const confirm = page.getByRole("dialog", { name: "この記録を削除しますか？" });
  await expect(confirm).toContainText(records[1].body); await expect(confirm).toContainText("この端末のブラウザーの記録");
  await confirm.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(page.locator(".dayGroup .memoryCard").nth(1)).toBeFocused(); await expect(actions).toHaveCount(0);
  await drag(page, 0, -100); await drag(page, 0, 110); await expect(actions).toHaveCount(0);
  await page.locator(".dayGroup .memoryCard").first().scrollIntoViewIfNeeded();
  const b = (await page.locator(".dayGroup .memoryCard").first().boundingBox())!;
  const cdp = await context.newCDPSession(page); const x = b.x + b.width * .8, y = b.y + 35;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - i * 12, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(actions).toHaveCount(1); await expect(page.getByRole("dialog")).toHaveCount(0);
  await actions.click(); await confirm.getByRole("button", { name: "この1件を削除", exact: true }).click();
  await expect(page.getByText("メモを削除しました。", { exact: true })).toBeVisible();
  await expect(page.locator(".dayGroup .memoryCard")).toHaveCount(2);
  await expect(page.locator(".walkingNotes")).not.toContainText(records[0].body);
  await page.reload(); await page.getByRole("button", { name: "ノート", exact: true }).click(); await expect(page.locator(".dayGroup .memoryCard")).toHaveCount(2);
});

test("keyboard detail deletion works and an unfinished draft prevents swipe deletion", async ({ page }) => {
  await setup(page);
  const card = page.locator(".dayGroup .memoryCard").first();
  await card.focus(); await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "この記録を削除", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "この記録を削除しますか？" })).toContainText(records[0].body);
  await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "この記録を削除", exact: true })).toBeFocused();
  await page.getByRole("dialog", { name: "場所に残した言葉" }).getByRole("button", { name: "閉じる", exact: true }).click();
  await page.getByRole("button", { name: "書く", exact: true }).click(); await page.getByLabel("この場所で何を見つけましたか？").fill("途中の言葉を残す");
  await expect(page.getByRole("status").filter({ hasText: "下書きを端末に保存しました" })).toBeVisible();
  await page.getByRole("button", { name: "下書きのまま閉じる", exact: true }).click();
  await drag(page, 0, -100); await expect(page.locator(".swipeDelete:visible")).toHaveCount(0);
  await page.getByRole("button", { name: "メニュー", exact: true }).click(); await page.getByRole("button", { name: "使い方・よくある質問", exact: false }).click();
  await page.getByText("1件だけ削除するには？", { exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("現在、削除の取り消しには対応していません。");
  await page.getByRole("dialog").getByRole("button", { name: "閉じる", exact: true }).click();
  await page.getByRole("button", { name: "続きを書く", exact: true }).click(); await expect(page.getByLabel("この場所で何を見つけましたか？")).toHaveValue("途中の言葉を残す");
});

test("management stays out of reading and downloads every record including those outside a search", async ({ page }) => {
  await setup(page);
  await expect(page.getByRole("button", { name: /ダウンロード|すべて削除|以前のデモから/ })).toHaveCount(0);
  await page.getByLabel("言葉を探す").fill("パン屋"); await expect(page.locator(".dayGroup .memoryCard")).toHaveCount(1);
  await page.getByRole("button", { name: "メニュー", exact: true }).click(); await page.getByRole("button", { name: /記録の管理/ }).click(); await page.getByRole("button", { name: /記録をダウンロード/ }).click();
  await expect(page.getByRole("dialog")).toContainText("アプリへの読み戻しには、まだ対応していません。");
  const downloadPromise = page.waitForEvent("download"); await page.getByRole("button", { name: "ダウンロードする", exact: true }).click();
  const download = await downloadPromise; const fs = await import("node:fs/promises"); const data = JSON.parse(await fs.readFile((await download.path())!, "utf8"));
  expect(data.count).toBe(3);
  await page.screenshot({ path: "/tmp/machiaruki-redesign-download.png", fullPage: true });
  await page.getByRole("dialog").getByRole("button", { name: "閉じる", exact: true }).click(); await expect(page.getByLabel("言葉を探す")).toHaveValue("パン屋"); await expect(page.locator(".dayGroup .memoryCard")).toHaveCount(1);
  await page.getByRole("button", { name: "検索を解除", exact: true }).click(); await expect(page.locator(".dayGroup .memoryCard")).toHaveCount(3);
  await page.screenshot({ path: "/tmp/machiaruki-redesign-notes.png", fullPage: true });
  await page.reload(); await expect(page.getByRole("button", { name: "説明を閉じる", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /保存先：このブラウザー/ }).click(); await expect(page.getByRole("dialog")).toContainText("閲覧データの削除や端末の故障で記録を失うことがあります。");
  await page.getByRole("dialog").getByRole("button", { name: "閉じる", exact: true }).click();
  for (const width of [320, 390, 1024]) { await page.setViewportSize({ width, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
});
