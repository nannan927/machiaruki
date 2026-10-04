import test from "node:test";
import assert from "node:assert/strict";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://ownership-test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
const owner = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";

test("authenticated operations constrain ownership and cannot overwrite another user's memo", async () => {
  const { GET, POST } = await import("../app/api/memos/route");
  const { PATCH, DELETE } = await import("../app/api/memos/[id]/route");
  const original = globalThis.fetch;
  const calls: { url: URL; method: string; body: Record<string, unknown> | null }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return new Response(JSON.stringify({ id: owner, aud: "authenticated", role: "authenticated" }), { headers: { "Content-Type": "application/json" } });
    const method = init?.method || "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    // Empty selection simulates a target belonging to another account (or missing).
    return new Response(JSON.stringify(method === "POST" ? { id, user_id: owner } : []), { headers: { "Content-Type": "application/json" } });
  };
  const request = (method: string) => new Request("http://localhost/api/memos", { method, headers: { Authorization: "Bearer valid-token", "Content-Type": "application/json", "Idempotency-Key": id, "If-Match": "1" }, ...(method === "POST" || method === "PATCH" ? { body: JSON.stringify({ body: "hello", lat: 35, lng: 139, user_id: "attacker-supplied-owner" }) } : {}) });
  try {
    assert.equal((await GET(request("GET"))).status, 200);
    assert.equal((await POST(request("POST"))).status, 201);
    assert.equal((await PATCH(request("PATCH"), { params: Promise.resolve({ id }) })).status, 409);
    assert.equal((await DELETE(request("DELETE"), { params: Promise.resolve({ id }) })).status, 409);
    for (const call of calls) {
      if (call.method === "POST") assert.equal(call.body?.user_id, owner);
      else assert.equal(call.url.searchParams.get("user_id"), `eq.${owner}`);
      if (call.method === "PATCH" || call.method === "DELETE") assert.equal(call.url.searchParams.get("version"), "eq.1");
      if (call.method === "PATCH") assert.equal(call.body?.user_id, undefined);
    }
    assert.equal(calls.length, 4);
  } finally { globalThis.fetch = original; }
});

test("an invalid token is rejected before touching memo data", async () => {
  const { GET } = await import("../app/api/memos/route");
  const original = globalThis.fetch;
  globalThis.fetch = async input => {
    assert.equal(new URL(String(input)).pathname, "/auth/v1/user");
    return new Response(JSON.stringify({ message: "invalid JWT" }), { status: 401, headers: { "Content-Type": "application/json" } });
  };
  try { assert.equal((await GET(new Request("http://localhost/api/memos", { headers: { Authorization: "Bearer invalid-token" } }))).status, 401); }
  finally { globalThis.fetch = original; }
});
