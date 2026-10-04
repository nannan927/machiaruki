import test from "node:test";
import assert from "node:assert/strict";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://guest-account-test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-public-key";
test("import cannot send a previous account's confirmed records using a different account session", async () => {
  const { getBrowserClient } = await import("../lib/supabase");
  const { memoRequest } = await import("../lib/client-api");
  const original = globalThis.fetch;
  let apiCalls = 0;
  globalThis.fetch = async input => {
    if (String(input).includes("/token")) return new Response(JSON.stringify({ access_token: "test-token", token_type: "bearer", refresh_token: "test-refresh", expires_in: 3600, user: { id: "account-b", aud: "authenticated", email: "b@example.com" } }), { headers: { "Content-Type": "application/json" } });
    apiCalls++; return new Response("{}");
  };
  const client = getBrowserClient()!;
  try {
    await client.auth.signInWithPassword({ email: "b@example.com", password: "test-password" });
    await assert.rejects(() => memoRequest("", { method: "POST", body: "private-record" }, "account-a"), /ログイン先が変わりました/);
    assert.equal(apiCalls, 0);
  } finally { client.auth.stopAutoRefresh(); globalThis.fetch = original; }
});
