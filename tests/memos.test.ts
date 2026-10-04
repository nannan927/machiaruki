import test from "node:test";
import assert from "node:assert/strict";
import { parseMemo } from "../lib/memo-validation";
import { filterMemos } from "../lib/memo-search";
import { GET, POST } from "../app/api/memos/route";
import { PATCH, DELETE } from "../app/api/memos/[id]/route";
import { readMemo } from "../lib/memo-api";

const valid = { title: "  路地  ", body: "  夕陽  ", lat: 35, lng: 139, tags: ["風", " 風 ", ""] };
test("normalizes input and does not accept ownership from the client", () => {
  assert.deepEqual(parseMemo({ ...valid, user_id: "someone-else" }), { title: "路地", body: "夕陽", lat: 35, lng: 139, tags: ["風"] });
});
test("rejects malformed and oversized input", () => {
  for (const input of [null, [], "text", { ...valid, body: 12 }, { ...valid, body: "  " }, { ...valid, body: "a".repeat(2001) }, { ...valid, title: 5 }, { ...valid, title: "a".repeat(121) }, { ...valid, lat: NaN }, { ...valid, lat: 91 }, { ...valid, lng: Infinity }, { ...valid, lng: -181 }, { ...valid, tags: "bad" }, { ...valid, tags: [5] }, { ...valid, tags: Array(11).fill("a") }, { ...valid, tags: ["a".repeat(41)] }]) assert.throws(() => parseMemo(input));
});
test("accepts boundary coordinates", () => { assert.equal(parseMemo({ ...valid, lat: -90, lng: 180 }).lng, 180); });
test("search covers title body tags and normalized AND terms", () => {
  const memos = [{ id: "1", user_id: "u", title: "ＣＡＦＥ", body: "路地の夕陽", tags: ["風"], lat: 35, lng: 139, created_at: "2026-01-01", updated_at: "2026-01-01" }];
  assert.equal(filterMemos(memos, "cafe 風").length, 1);
  assert.equal(filterMemos(memos, "夕陽").length, 1);
  assert.equal(filterMemos(memos, "海").length, 0);
  assert.equal(filterMemos(memos, "   ").length, 1);
});
test("all memo endpoints reject unauthenticated calls", async () => {
  const request = new Request("http://localhost/api/memos");
  for (const response of [await GET(request), await POST(request), await PATCH(request, { params: Promise.resolve({ id: "x" }) }), await DELETE(request, { params: Promise.resolve({ id: "x" }) })]) assert.equal(response.status, 401);
});
test("invalid JSON returns 400 instead of an internal error", async () => {
  const result = await readMemo(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }));
  assert.equal(result.response?.status, 400);
});
