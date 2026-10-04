import test from "node:test";
import assert from "node:assert/strict";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://api-test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
const userId = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const input = { title: "タイトル", body: "本文", lat: 35, lng: 139, tags: ["風"] };
const memo = { ...input, id, user_id: userId, version: 1, created_at: "2026-10-04T00:00:00+00:00", updated_at: "2026-10-04T00:00:00+00:00" };
function request(method: string, path = "", headers = {}) {
  return new Request(`http://localhost/api/memos${path}`, { method, headers: { Authorization: "Bearer valid-token", "Content-Type": "application/json", "Idempotency-Key": id, "If-Match": "1", ...headers }, ...(method === "POST" || method === "PATCH" ? { body: JSON.stringify(input) } : {}) });
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
test("production API pagination, replay, conflicts, and errors", async t => {
  const { GET, POST } = await import("../app/api/memos/route");
  const { PATCH } = await import("../app/api/memos/[id]/route");
  const original = globalThis.fetch;
  let handle: (url: URL, init?: RequestInit) => Response = () => json([]);
  globalThis.fetch = async (url, init) => new URL(String(url)).pathname === "/auth/v1/user" ? json({ id: userId, aud: "authenticated" }) : handle(new URL(String(url)), init);
  try {
    await t.test("guest import preserves original date and authenticated owner; invalid dates are rejected", async () => {
      const originalDate = "2026-01-02T00:00:00.000Z";
      handle = (_url, init) => { const row = JSON.parse(String(init?.body)); assert.equal(row.created_at, originalDate); assert.equal(row.user_id, userId); return json({ ...memo, created_at: originalDate }); };
      assert.equal((await POST(request("POST", "", { "X-Memo-Created-At": originalDate }))).status, 201);
      for (const date of ["tomorrow", "2999-01-01T00:00:00.000Z", "1960-01-01T00:00:00.000Z"]) assert.equal((await POST(request("POST", "", { "X-Memo-Created-At": date }))).status, 400);
    });
    await t.test("51 rows produce 50 results and a safe continuation", async () => {
      handle = url => { assert.equal(url.searchParams.get("limit"), "51"); assert.equal(url.searchParams.get("order"), "created_at.desc,id.desc"); return json(Array.from({ length: 51 }, (_, i) => ({ ...memo, id: `00000000-0000-4000-8000-${String(100 - i).padStart(12, "0")}` }))); };
      const response = await GET(request("GET"));
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      const data = await response.json(); assert.equal(data.items.length, 50); assert.ok(data.nextCursor);
      handle = url => { assert.ok(url.searchParams.get("or")?.includes("id.lt.")); return json([]); };
      assert.equal((await GET(request("GET", `?cursor=${data.nextCursor}`))).status, 200);
    });
    await t.test("search escapes wildcards and restricts owner", async () => {
      handle = url => { assert.equal(url.searchParams.get("user_id"), `eq.${userId}`); assert.deepEqual(url.searchParams.getAll("search_text"), ["ilike.%100\\%%", "ilike.%風%"]); return json([]); };
      assert.equal((await GET(request("GET", `?q=${encodeURIComponent("100% 風")}`))).status, 200);
    });
    await t.test("duplicate create returns existing memo for same owner and payload", async () => {
      handle = (url, init) => {
        if (init?.method === "POST") return json({ code: "23505", message: "duplicate" }, 409);
        assert.equal(url.searchParams.get("user_id"), `eq.${userId}`); return json([memo]);
      };
      const response = await POST(request("POST")); assert.equal(response.status, 200); assert.equal((await response.json()).id, id);
    });
    await t.test("duplicate ID with changed content never overwrites", async () => {
      handle = (_url, init) => init?.method === "POST" ? json({ code: "23505" }, 409) : json([{ ...memo, body: "other content" }]);
      assert.equal((await POST(request("POST"))).status, 409);
    });
    await t.test("stale version returns conflict", async () => {
      handle = url => { assert.equal(url.searchParams.get("version"), "eq.1"); return json([]); };
      assert.equal((await PATCH(request("PATCH"), { params: Promise.resolve({ id }) })).status, 409);
      assert.equal((await PATCH(request("PATCH", "", { "If-Match": "" }), { params: Promise.resolve({ id }) })).status, 428);
    });
    await t.test("database errors do not expose internal details", async () => {
      handle = () => json({ message: "private database detail" }, 500);
      const response = await GET(request("GET")); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes("private database"));
    });
  } finally { globalThis.fetch = original; }
});
