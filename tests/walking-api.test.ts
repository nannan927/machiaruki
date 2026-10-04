import test from "node:test";
import assert from "node:assert/strict";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://walking-test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
const owner = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const request = (path: string, authenticated = true) => new Request(`http://localhost/api/memos/${path}`, { headers: authenticated ? { Authorization: "Bearer token" } : {} });
test("map and detail endpoints enforce authentication and owner bounds", async () => {
  const { GET: map } = await import("../app/api/memos/map/route");
  const { GET: detail } = await import("../app/api/memos/[id]/route");
  assert.equal((await map(request("map", false))).status, 401);
  assert.equal((await detail(request(id, false), { params: Promise.resolve({ id }) })).status, 401);
  const original = globalThis.fetch; let dataCalls = 0;
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: owner, aud: "authenticated" });
    dataCalls++; assert.equal(url.searchParams.get("user_id"), `eq.${owner}`);
    if (url.searchParams.has("lat")) {
      assert.deepEqual(url.searchParams.getAll("lat"), ["gte.30", "lte.40"]);
      assert.deepEqual(url.searchParams.getAll("lng"), ["gte.130", "lte.140"]);
      assert.equal(url.searchParams.get("limit"), "201"); assert.equal(url.searchParams.get("search_text"), "ilike.%風%");
      return Response.json(Array.from({ length: 201 }, (_, i) => ({ id: String(i) })));
    }
    assert.equal(url.searchParams.get("id"), `eq.${id}`); return Response.json([]);
  };
  try {
    assert.equal((await map(request("map?west=broken"))).status, 400); assert.equal(dataCalls, 0);
    const result = await map(request(`map?west=130&south=30&east=140&north=40&q=${encodeURIComponent("風")}`));
    assert.equal(result.headers.get("cache-control"), "private, no-store");
    const data = await result.json(); assert.equal(data.items.length, 200); assert.equal(data.truncated, true);
    assert.equal((await detail(request(id), { params: Promise.resolve({ id }) })).status, 404);
  } finally { globalThis.fetch = original; }
});
