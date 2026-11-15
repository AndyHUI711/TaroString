import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { SignJWT } from 'jose';
import worker from '../src/index.js';

const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../migrations/007_stringer_overview.sql', import.meta.url), 'utf8');
const secret = 'overview-test-session-secret-1234';

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  db.exec(`INSERT INTO users (id, email, password_hash, is_stringer) VALUES
    (1, 'one@example.com', 'x', 1), (2, 'two@example.com', 'x', 1),
    (3, 'customer@example.com', 'x', 0), (4, 'empty@example.com', 'x', 1);
    INSERT INTO rackets (id, uuid, racket_brand, racket_model) VALUES
    (1, '00000000-0000-4000-8000-000000000001', 'Yonex', 'One'),
    (2, '00000000-0000-4000-8000-000000000002', 'yonex', 'Two'),
    (3, '00000000-0000-4000-8000-000000000003', NULL, 'Three');
    INSERT INTO string_jobs (racket_id, stringer_id, main_brand, main_model, main_tension, cross_brand, cross_model, cross_tension, strung_at) VALUES
    (1, 1, 'Luxilon', 'A', 48, NULL, NULL, NULL, '2026-01-01'),
    (1, 1, 'Luxilon', 'A', 48, 'luxilon', 'B', 46, '2026-01-02'),
    (2, 1, 'Luxilon', 'A', 48, 'Yonex', 'B', 46, '2026-01-03'),
    (3, 1, NULL, 'C', 48, NULL, NULL, NULL, '2026-01-04'),
    (2, 2, 'Other', 'D', 48, NULL, NULL, NULL, '2026-01-05'),
    (2, NULL, 'Legacy', 'E', 48, NULL, NULL, NULL, '2026-01-06');`);
  return db;
}

function binding(db) {
  return {
    prepare(sql) {
      let params = [];
      return {
        bind(...values) { params = values; return this; },
        async first() { return db.prepare(sql).get(...params) || null; },
        async all() { return { results: db.prepare(sql).all(...params) }; },
      };
    },
  };
}

async function cookie(id, stringer = true) {
  const token = await new SignJWT({ uid: id, email: `user${id}@example.com`, stringer })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret));
  return `session=${token}`;
}

async function request(db, method = 'GET', body, session) {
  const headers = {};
  if (session) headers.cookie = session;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await worker.fetch(new Request('https://example.test/api/overview', {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: binding(db), SESSION_SECRET: secret });
  return { status: response.status, data: await response.json() };
}

test('overview migration is repeatable and preserves saved settings', () => {
  const db = database();
  db.exec('DROP TABLE stringer_overview_settings; DROP INDEX idx_jobs_stringer;');
  db.exec(migration);
  db.exec('INSERT INTO stringer_overview_settings VALUES (1, 65)');
  db.exec(migration);
  assert.equal(db.prepare('SELECT historical_count FROM stringer_overview_settings WHERE user_id = 1').get().historical_count, 65);
  db.close();
});

test('personal totals, hybrid brand counts, restrings and offset stay isolated', async () => {
  const db = database();
  const first = await cookie(1);
  const second = await cookie(2);
  let res = await request(db, 'GET', undefined, first);
  assert.equal(res.status, 200);
  assert.equal(res.data.recorded_jobs, 4);
  assert.equal(res.data.recorded_rackets, 3);
  assert.equal(res.data.lifetime_jobs, 4);
  assert.equal(res.data.offset_configured, false);
  assert.deepEqual(res.data.racket_brands.map(({ brand, jobs }) => [brand?.toLowerCase() ?? null, jobs]), [['yonex', 3], [null, 1]]);
  assert.deepEqual(res.data.string_brands.map(({ brand, jobs }) => [brand?.toLowerCase() ?? null, jobs]), [['luxilon', 3], [null, 1], ['yonex', 1]]);
  assert.equal(res.data.recent_jobs.length, 4);
  assert.equal(res.data.recent_jobs[0].racket_model, 'Three');

  res = await request(db, 'PUT', { historical_count: 65, user_id: 2 }, first);
  assert.equal(res.status, 200);
  res = await request(db, 'GET', undefined, first);
  assert.equal(res.data.historical_count, 65);
  assert.equal(res.data.offset_configured, true);
  assert.equal(res.data.lifetime_jobs, 69);
  assert.equal(res.data.recorded_rackets, 3);
  res = await request(db, 'GET', undefined, second);
  assert.equal(res.data.lifetime_jobs, 1);
  assert.equal(res.data.historical_count, 0);
  assert.equal(res.data.recent_jobs[0].main_brand, 'Other');
  res = await request(db, 'PUT', { historical_count: 0 }, first);
  assert.equal(res.status, 200);
  res = await request(db, 'GET', undefined, first);
  assert.equal(res.data.lifetime_jobs, 4);
  assert.equal(res.data.offset_configured, true);
  db.close();
});

test('overview requires an existing stringer and validates historical count', async () => {
  const db = database();
  for (const session of [undefined, await cookie(3, false), await cookie(3, true), await cookie(99)]) {
    assert.equal((await request(db, 'GET', undefined, session)).status, 403);
    assert.equal((await request(db, 'PUT', { historical_count: 65 }, session)).status, 403);
  }
  const session = await cookie(1);
  for (const value of [-1, 1000001, 1.5, '65', null, true]) {
    const res = await request(db, 'PUT', { historical_count: value }, session);
    assert.equal(res.status, 400);
    assert.equal(res.data.error_code, 'OVERVIEW_OFFSET_INVALID');
  }
  assert.equal((await request(db, 'PUT', { historical_count: 1000000 }, session)).status, 200);
  db.close();
});

test('a new stringer starts with empty statistics and no applied offset', async () => {
  const db = database();
  const res = await request(db, 'GET', undefined, await cookie(4));
  assert.equal(res.status, 200);
  assert.equal(res.data.recorded_jobs, 0);
  assert.equal(res.data.recorded_rackets, 0);
  assert.equal(res.data.lifetime_jobs, 0);
  assert.equal(res.data.offset_configured, false);
  assert.deepEqual(res.data.racket_brands, []);
  assert.deepEqual(res.data.string_brands, []);
  assert.deepEqual(res.data.recent_jobs, []);
  db.close();
});
