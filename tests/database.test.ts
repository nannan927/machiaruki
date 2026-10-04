import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const id = "33333333-3333-4333-8333-333333333333";
test("Postgres migrations enforce ownership, data integrity, and versions", async t => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      insert into auth.users values ('${A}'), ('${B}');`);
    const files = (await readdir("supabase/migrations")).filter(file => file.endsWith(".sql")).sort();
    for (const [index, file] of files.entries()) {
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
      if (index === 0) await db.exec("insert into memos(body,lat,lng) values ('legacy anonymous',35,139)");
    }
    async function asUser(user: string) { await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`); }
    await asUser(A);
    await t.test("legacy rows remain hidden and own row is visible", async () => {
      assert.equal((await db.query("select id from memos")).rows.length, 0);
      await db.query("insert into memos(id,body,title,lat,lng,tags) values ($1,'路地でひと休み','ＣＡＦＥ',35,139,ARRAY['風'])", [id]);
      const row = (await db.query<{ user_id: string; version: number }>("select user_id,version from memos")).rows[0];
      assert.equal(row.user_id, A); assert.equal(row.version, 1);
    });
    await t.test("direct DB access cannot forge another owner or system fields", async () => {
      await assert.rejects(db.query("insert into memos(user_id,body,lat,lng) values ($1,'forged',35,139)", [B]));
      await assert.rejects(db.query("update memos set user_id=$1 where id=$2", [B,id]));
      await assert.rejects(db.query("update memos set version=99 where id=$1", [id]));
      await assert.rejects(db.query("insert into memos(body,lat,lng,created_at) values ('forged',35,139,now())"));
    });
    await t.test("database enforces tag size and nonfinite coordinates", async () => {
      await assert.rejects(db.query("insert into memos(body,lat,lng,tags) values ('x',35,139,ARRAY[null])"));
      await assert.rejects(db.query("insert into memos(body,lat,lng,tags) values ('x',35,139,ARRAY[repeat('a',41)])"));
      await assert.rejects(db.query("insert into memos(body,lat,lng) values ('x','NaN'::float8,139)"));
    });
    await t.test("NFKC search covers title, text, and tags", async () => {
      const found = await db.query("select id from memos where search_text like '%cafe%' and search_text like '%風%'");
      assert.equal(found.rows.length, 1);
    });
    await t.test("stale edit does not overwrite a newer edit", async () => {
      assert.equal((await db.query("update memos set body='new body' where id=$1 and version=1 returning version", [id])).rows.length, 1);
      assert.equal((await db.query("update memos set body='stale body' where id=$1 and version=1 returning version", [id])).rows.length, 0);
      assert.equal((await db.query<{ version: number }>("select version from memos where id=$1", [id])).rows[0].version, 2);
    });
    await asUser(B);
    await t.test("user B cannot read, edit, or delete user A's row", async () => {
      assert.equal((await db.query("select id from memos")).rows.length, 0);
      assert.equal((await db.query("update memos set body='stolen' where id=$1 returning id", [id])).rows.length, 0);
      assert.equal((await db.query("delete from memos where id=$1 returning id", [id])).rows.length, 0);
    });
    await db.exec("reset role; set role anon;");
    await t.test("anonymous access is denied", async () => {
      await assert.rejects(db.query("select * from memos"));
      await assert.rejects(db.query("insert into memos(body,lat,lng) values ('x',35,139)"));
    });
    await asUser(A);
    await t.test("stale delete is rejected and current version can be deleted", async () => {
      assert.equal((await db.query("delete from memos where id=$1 and version=1 returning id", [id])).rows.length, 0);
      assert.equal((await db.query("delete from memos where id=$1 and version=2 returning id", [id])).rows.length, 1);
    });
    await db.exec("reset role");
    assert.equal((await db.query("select * from memos where user_id is null")).rows.length, 1);
  } finally { await db.close(); }
});
