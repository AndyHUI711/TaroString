import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { SignJWT } from 'jose';
import worker from '../src/index.js';

const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const migration8 = readFileSync(new URL('../migrations/008_string_performance.sql', import.meta.url), 'utf8');
const migration8Data = readFileSync(new URL('../migrations/008_string_perf_data.sql', import.meta.url), 'utf8');
const secret = 'search-test-session-secret-1234';

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  db.exec(migration8);
  db.exec(migration8Data);
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
        async run() { return db.prepare(sql).run(...params); },
      };
    },
  };
}

async function cookie(stringer) {
  const token = await new SignJWT({ uid: 1, email: 'test@example.com', stringer })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret));
  return `session=${token}`;
}

async function request(db, path, method = 'GET', body, session) {
  const headers = {};
  if (session) headers.cookie = session;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await worker.fetch(new Request(`https://example.test${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: binding(db), SESSION_SECRET: secret, ADMIN_TOKEN: 'desk-secret' });
  return { status: response.status, data: await response.json() };
}

test('string_performance table is seeded and searchable', async () => {
  const db = database();
  const count = db.prepare('SELECT COUNT(*) AS n FROM string_performance').get();
  assert.ok(count.n >= 598, `expected >= 598 rows, got ${count.n}`);

  const res = await request(db, '/api/catalog/strings', 'POST', { keyword: 'ALU Power' });
  assert.equal(res.status, 200);
  assert.ok(res.data.count >= 1);
  assert.ok(res.data.strings.some((s) => s.name.includes('ALU Power')));

  const res2 = await request(db, '/api/catalog/strings', 'POST', { material: 'Gut', min_overall: 4 });
  assert.equal(res2.status, 200);
  for (const s of res2.data.strings) {
    assert.equal(s.material, 'Gut');
    assert.ok(s.overall === null || s.overall >= 4);
  }

  const res3 = await request(db, '/api/catalog/strings', 'POST', { keyword: 'zzzznotexist' });
  assert.equal(res3.status, 200);
  assert.equal(res3.data.count, 0);

  db.close();
});

test('stringers can save a string and it becomes searchable', async () => {
  const db = database();
  const session = await cookie(true);

  const created = await request(db, '/api/catalog/strings/save', 'POST', {
    name: 'Test Poly 16',
    material: 'Polyester',
    gauge: 1.3,
    comfort: 3,
    power: 4,
    overall: 4,
  }, session);
  assert.equal(created.status, 200);
  assert.equal(created.data.string.name, 'Test Poly 16');
  assert.equal(created.data.string.overall, 4);

  const found = await request(db, '/api/catalog/strings', 'POST', { keyword: 'Test Poly' });
  assert.ok(found.data.strings.some((s) => s.name === 'Test Poly 16'));

  // upsert: same name updates instead of duplicating
  const updated = await request(db, '/api/catalog/strings/save', 'POST', {
    name: 'Test Poly 16',
    material: 'Polyester',
    overall: 5,
  }, session);
  assert.equal(updated.status, 200);
  assert.equal(updated.data.string.overall, 5);
  const count = db.prepare("SELECT COUNT(*) AS n FROM string_performance WHERE name = 'Test Poly 16'").get();
  assert.equal(count.n, 1);

  db.close();
});

test('saving a string requires a stringer account', async () => {
  const db = database();

  const anon = await request(db, '/api/catalog/strings/save', 'POST', { name: 'Nope 16' });
  assert.equal(anon.status, 403);
  assert.equal(anon.data.error_code, 'CATALOG_FORBIDDEN');

  const customer = await request(db, '/api/catalog/strings/save', 'POST', { name: 'Nope 16' }, await cookie(false));
  assert.equal(customer.status, 403);

  db.close();
});