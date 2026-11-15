import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { SignJWT } from 'jose';
import worker from '../src/index.js';

const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../migrations/006_brand_catalog.sql', import.meta.url), 'utf8');
const secret = 'catalog-test-session-secret-1234';

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
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

test('migration seeds brands, imports historical custom brands and preserves jobs', () => {
  const db = database();
  db.exec('DROP TABLE string_models; DROP TABLE brands;');
  db.exec(`INSERT INTO rackets (uuid, racket_brand, racket_model) VALUES ('old', ' Custom Racket ', 'Model');
    INSERT INTO string_jobs (racket_id, main_brand, main_model, main_tension, cross_brand, cross_model, cross_tension)
    VALUES (1, 'Custom Main', 'Old main', 48, 'Custom Cross', 'Old cross', 46);`);
  db.exec(migration);
  db.exec(migration);
  const names = db.prepare('SELECT kind, name FROM brands').all().map((row) => `${row.kind}:${row.name}`);
  assert.equal(names.length, 47);
  for (const name of ['racket:Yonex', 'string:Luxilon', "string:Pro's Pro", 'racket:Custom Racket', 'string:Custom Main', 'string:Custom Cross']) {
    assert.ok(names.includes(name), name);
  }
  const job = db.prepare('SELECT main_model, cross_model FROM string_jobs WHERE id = 1').get();
  assert.equal(job.main_model, 'Old main');
  assert.equal(job.cross_model, 'Old cross');
  db.close();
});

test('public catalog and stringer-only brand and rated model management', async () => {
  const db = database();
  const stringer = await cookie(true);
  const customer = await cookie(false);
  let res = await request(db, '/api/catalog');
  assert.equal(res.status, 200);
  assert.equal(res.data.brands.length, 44);
  assert.deepEqual(res.data.models, []);

  for (const session of [undefined, customer]) {
    res = await request(db, '/api/catalog/brands', 'POST', { kind: 'string', name: 'New' }, session);
    assert.equal(res.status, 403);
    res = await request(db, '/api/catalog/models', 'POST', { brand_id: 1, name: 'Test' }, session);
    assert.equal(res.status, 403);
  }
  res = await request(db, '/api/catalog/brands', 'POST', { kind: 'string', name: 'New', admin_token: 'desk-secret' });
  assert.equal(res.status, 403);
  for (const body of [
    { kind: 'string', name: '  ' },
    { kind: 'string', name: 'x'.repeat(41) },
    { kind: 'other', name: 'New' },
  ]) {
    res = await request(db, '/api/catalog/brands', 'POST', body, stringer);
    assert.equal(res.status, 400);
  }
  res = await request(db, '/api/catalog/brands', 'POST', { kind: 'string', name: ' New ' }, stringer);
  assert.equal(res.status, 201);
  const brandId = res.data.brand.id;
  assert.equal(res.data.brand.name, 'New');
  res = await request(db, '/api/catalog/brands', 'POST', { kind: 'string', name: 'new' }, stringer);
  assert.equal(res.status, 409);
  res = await request(db, '/api/catalog/brands', 'POST', { kind: 'racket', name: 'New' }, stringer);
  assert.equal(res.status, 201);
  const racketBrandId = res.data.brand.id;
  res = await request(db, '/api/catalog/models', 'POST', { brand_id: racketBrandId, name: 'Test' }, stringer);
  assert.equal(res.data.error_code, 'CATALOG_BRAND_INVALID');
  for (const value of [0, 6, 1.5, '5', true]) {
    res = await request(db, '/api/catalog/models', 'POST', { brand_id: brandId, name: 'Test', power: value }, stringer);
    assert.equal(res.data.error_code, 'CATALOG_RATING_INVALID');
  }
  res = await request(db, '/api/catalog/models', 'POST', {
    brand_id: brandId, name: 'Test', power: 5, control: 1, spin: null, durability: 4,
  }, stringer);
  assert.equal(res.status, 200);
  assert.equal(res.data.model.power, 5);
  res = await request(db, '/api/catalog/models', 'POST', {
    brand_id: brandId, name: 'test', power: null, control: 2, spin: 3, durability: 5,
  }, stringer);
  assert.equal(res.status, 200);
  res = await request(db, '/api/catalog');
  assert.equal(res.data.models.length, 1);
  assert.deepEqual(
    [res.data.models[0].power, res.data.models[0].control, res.data.models[0].spin, res.data.models[0].durability],
    [null, 2, 3, 5],
  );
  db.close();
});

test('fresh and migrated catalogs have the same default brands', () => {
  const fresh = database();
  const migrated = database();
  migrated.exec('DROP TABLE string_models; DROP TABLE brands;');
  migrated.exec(migration);
  const query = 'SELECT kind, name FROM brands ORDER BY kind, name';
  assert.deepEqual(migrated.prepare(query).all(), fresh.prepare(query).all());
  fresh.close();
  migrated.close();
});

test('existing free-text and hybrid job creation remains available with a desk token', async () => {
  const db = database();
  const res = await request(db, '/api/rackets', 'POST', {
    admin_token: 'desk-secret',
    racket_brand: 'Other racket', racket_model: 'Racket',
    main_brand: 'Other main', main_model: 'Main', main_tension: 48,
    cross_brand: 'Other cross', cross_model: 'Cross', cross_tension: 46,
  });
  assert.equal(res.status, 200);
  const racket = await request(db, `/api/rackets/${res.data.uuid}`);
  assert.equal(racket.status, 200);
  assert.equal(racket.data.racket.main_brand, 'Other main');
  assert.equal(racket.data.racket.cross_brand, 'Other cross');
  assert.equal(racket.data.racket.cross_tension, 46);
  db.close();
});
