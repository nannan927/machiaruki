import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
// Only mocked Auth accepts this unsigned token. Never send it to a real provider.
export async function mockGoogleSignIn(page: Page, user: { id: string; [key: string]: unknown }) {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  const token = `eyJhbGciOiJub25lIn0.${payload}.test`;
  await page.route("https://test-project.supabase.co/auth/v1/user", route => route.fulfill({ json: user }));
  await page.route("https://test-project.supabase.co/auth/v1/authorize**", route => route.fulfill({ status: 302, headers: { location: `http://localhost:3100/auth/callback#access_token=${token}&refresh_token=test-refresh&expires_in=3600&token_type=bearer` } }));
}
// Both block paid endpoints and fail the test if an accidental request is attempted.
const google = /^https?:\/\/[^/]*(?:googleapis\.com|gstatic\.com|google\.com)(?:\/|$)/;
export const gsiTiles = "https://cyberjapandata.gsi.go.jp/xyz/pale/**";
// Render real Leaflet against a deterministic local tile response, never the live service.
export const tileBody = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#f5f2e9"/><path d="M0 80H256M110 0V256" stroke="#fff" stroke-width="14"/><path d="M0 80H256M110 0V256" stroke="#d6cebc" fill="none"/></svg>';
export const test = base.extend<{ blockPaidMaps: void }>({
  blockPaidMaps: [async ({ context }, use) => {
    let attempts = 0;
    context.on("request", request => { if (google.test(request.url())) attempts++; });
    await context.route(/^https:\/\//, route => route.abort());
    await context.route(gsiTiles, route => route.fulfill({ contentType: "image/svg+xml", body: tileBody }));
    await use();
    expect(attempts, "No Google Maps network requests are allowed during tests").toBe(0);
  }, { auto: true }],
});
export { expect };
