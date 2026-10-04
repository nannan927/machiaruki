import test from "node:test";
import assert from "node:assert/strict";
import { decodeCursor, encodeCursor, escapeLike, searchTerms } from "../lib/memo-page";
import { readMemo, readVersion } from "../lib/memo-api";
import type { Memo } from "../types/memo";
test("cursor validates identifiers and prevents injected query syntax", () => {
  const memo = { id: "11111111-1111-4111-8111-111111111111", created_at: "2026-10-04T12:34:56.123456+00:00" } as Memo;
  assert.deepEqual(decodeCursor(encodeCursor(memo)), { id: memo.id, date: memo.created_at });
  for (const value of ["bad", "x".repeat(301), Buffer.from(JSON.stringify({ id: "x),user_id.neq.y", date: memo.created_at })).toString("base64url")]) assert.throws(() => decodeCursor(value));
});
test("search treats SQL LIKE wildcards as literal text", () => {
  assert.equal(escapeLike("100%_\\"), "100\\%\\_\\\\");
  assert.deepEqual(searchTerms(" ＣＡＦＥ 風 "), ["cafe", "風"]);
  assert.throws(() => searchTerms("a".repeat(201)));
});
test("payload bound works without trusting Content-Length", async () => {
  const request = new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: "a".repeat(17000) }) });
  assert.equal((await readMemo(request)).response?.status, 413);
  assert.equal((await readMemo(new Request("http://localhost", { method: "POST", body: "{}" }))).response?.status, 415);
});
test("mutations require a positive version", () => {
  assert.equal(readVersion(new Request("http://localhost")), null);
  for (const value of ["0", "-1", "NaN", "1 OR 1=1", "999999999999"]) assert.equal(readVersion(new Request("http://localhost", { headers: { "If-Match": value } })), null);
  assert.equal(readVersion(new Request("http://localhost", { headers: { "If-Match": '"3"' } })), 3);
});
