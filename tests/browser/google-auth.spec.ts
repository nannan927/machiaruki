import { test, expect } from "./fixtures";

const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "walker@example.com", app_metadata: { provider: "google" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };

test("Google entry redirects through Supabase with a fixed callback and no Maps requests", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "false");
  let destination = "";
  await page.route("https://test-project.supabase.co/auth/v1/authorize**", route => {
    destination = route.request().url();
    return route.fulfill({ contentType: "text/html", body: "<p>OAuth provider handoff</p>" });
  });
  await page.goto("/");
  await expect(page.getByText(/新規登録は受け付けていません/)).toHaveCount(0);
  await page.getByRole("button", { name: "Googleで始める・ログイン" }).click();
  await expect(page.getByText("OAuth provider handoff")).toBeVisible();
  const url = new URL(destination);
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("redirect_to")).toBe("http://localhost:3100/auth/callback");
  expect(url.searchParams.has("access_type")).toBe(false);
});

test("cancelled Google authorization offers a way back without showing provider errors", async ({ page }) => {
  await page.goto("/auth/callback#error=access_denied&error_description=private-provider-detail");
  await expect(page.locator("main").getByRole("alert")).toContainText("ログインを完了できませんでした");
  await expect(page.getByText("private-provider-detail")).toHaveCount(0);
  await page.getByRole("link", { name: "ログイン画面へ戻る" }).click();
  await expect(page.getByRole("button", { name: "ログインする", exact: true })).toBeVisible();
});

test("Google callback establishes a private notebook session and removes URL tokens", async ({ page }) => {
  await page.route("https://test-project.supabase.co/auth/v1/user", route => route.fulfill({ json: user }));
  await page.route("**/api/memos**", route => route.fulfill({ json: { items: [], nextCursor: null } }));
  // An unsigned test token accepted only by the mocked Auth endpoint.
  const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  const token = `eyJhbGciOiJub25lIn0.${payload}.test`;
  await page.goto(`/auth/callback#access_token=${token}&refresh_token=test-refresh&expires_in=3600&token_type=bearer`);
  await expect(page).toHaveURL("http://localhost:3100/");
  await expect(page.getByRole("button", { name: "書く", exact: true })).toBeVisible();
  expect(page.url()).not.toContain("access_token");
});
