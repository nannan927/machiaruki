import { test as base, expect } from "@playwright/test";
// Both block paid endpoints and fail the test if an accidental request is attempted.
const google = /^https?:\/\/[^/]*(?:googleapis\.com|gstatic\.com|google\.com)(?:\/|$)/;
export const test = base.extend<{ blockPaidMaps: void }>({
  blockPaidMaps: [async ({ context }, use) => {
    let attempts = 0;
    context.on("request", request => { if (google.test(request.url())) attempts++; });
    await context.route(/^https:\/\//, route => route.abort());
    await use();
    expect(attempts, "No Google Maps network requests are allowed during tests").toBe(0);
  }, { auto: true }],
});
export { expect };
