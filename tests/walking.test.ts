import test from "node:test";
import assert from "node:assert/strict";
import { dayGroups, memoLabel, parseBounds } from "../lib/walking-data";
import { performWrite } from "../lib/walking-save";
import { MemoRequestError } from "../lib/client-api";
import type { Memo } from "../types/memo";
const memo: Memo = { id: "22222222-2222-4222-8222-222222222222", user_id: "owner", title: null, body: "風のある路地", lat: 35, lng: 139, tags: [], version: 2, created_at: "2026-10-04T12:00:00Z", updated_at: "2026-10-04T12:00:00Z" };
const input = { body: memo.body, lat: 35, lng: 139, tags: [] };
test("map bounds reject missing, nonfinite, reversed and injected coordinates", () => {
  for (const value of ["", "west=NaN&south=0&east=1&north=1", "west=2&south=0&east=1&north=1", "west=-181&south=0&east=1&north=1", "west=0&south=0&east=1&north=90);select"]) assert.throws(() => parseBounds(new URLSearchParams(value)));
  assert.equal(parseBounds(new URLSearchParams("west=130&south=30&east=140&north=40")).east, 140);
});
test("untitled notes use words and daily notes are chronological", () => {
  assert.equal(memoLabel(memo), "風のある路地");
  const groups = dayGroups([memo, { ...memo, id: "early", created_at: "2026-10-04T11:00:00Z" }]);
  assert.equal(groups[0][1][0].id, "early");
});
test("lost create and update responses reconcile without duplicate writes", async () => {
  for (const method of ["POST", "PATCH"] as const) {
    let reads = 0;
    const result = await performWrite({ method, id: memo.id, version: 1, input }, true, async (path, init) => { assert.equal(path, `/${memo.id}`); assert.equal(init, undefined); reads++; return memo; });
    assert.equal(result?.id, memo.id); assert.equal(reads, 1);
  }
});
test("missing create retries the exact operation and missing delete is complete", async () => {
  let writes = 0;
  const request = async (_path = "", init?: RequestInit) => { if (!init) throw new MemoRequestError("not found", 404); writes++; assert.equal(new Headers(init.headers).get("idempotency-key"), memo.id); assert.deepEqual(JSON.parse(String(init.body)), input); return memo; };
  await performWrite({ method: "POST", id: memo.id, version: 1, input }, true, request);
  assert.equal(writes, 1);
  assert.equal(await performWrite({ method: "DELETE", id: memo.id, version: 1 }, true, async () => { throw new MemoRequestError("missing", 404); }), null);
});
test("conflicting or unreachable records never trigger a mutation", async () => {
  await assert.rejects(performWrite({ method: "PATCH", id: memo.id, version: 1, input }, true, async (_path, init) => { assert.equal(init, undefined); return { ...memo, body: "別の言葉" }; }), /別の変更/);
  await assert.rejects(performWrite({ method: "DELETE", id: memo.id, version: 1 }, true, async (_path, init) => { assert.equal(init, undefined); throw new MemoRequestError("offline", 0); }), /offline/);
});
