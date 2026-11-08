/**
 * 穿线球拍使用记录 · Cloudflare Worker
 *
 * 一个 Worker 同时承担：
 *   1. /api/*   接口（D1 + 自建会话认证 + Open-Meteo 天气 + 二维码生成）
 *   2. 其余路径  静态资源（public/ 目录）
 *
 * 关键约束：
 *   - 匿名提交使用记录：/api/rackets/:uuid/logs 不做登录校验
 *   - 天气失败绝不阻塞写入：定位缺失 / 超时 / API 报错 -> temperature_c = NULL，记录照常入库
 *   - 认领用 UPDATE ... WHERE owner_id IS NULL 原子判断，并发下不会重复认领
 *   - JWT 存 httpOnly + secure + SameSite=Lax cookie，前端 JS 读不到
 *   - 密码不落明文：PBKDF2-SHA256 + 随机盐
 *   - UUID 服务端生成（crypto.randomUUID），前端不参与
 *   - 所有 SQL 均参数化（db.prepare(...).bind(...)）
 *   - 所有错误同时返回 error_code，前端据此做多语言提示（繁 / 简 / 英）
 */

import { SignJWT, jwtVerify } from 'jose';
import qrcode from 'qrcode-generator';

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */

const SESSION_COOKIE = 'session';
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 天

// 免费档每次请求只有 10ms CPU，bcryptjs 会超时；PBKDF2 用原生 WebCrypto。
// 25k 轮约几毫秒。升级到 Workers Paid 后可提高到 100000+。
const PBKDF2_ITERATIONS = 25000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TENSION = 80;

const encoder = new TextEncoder();

/* ------------------------------------------------------------------ *
 * 响应工具
 * ------------------------------------------------------------------ */

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

/**
 * 统一错误：error_code 给前端做翻译，error 是中文兜底文案。
 * 前端遇到未知 code 时直接显示 error。
 */
function fail(code, status = 400, message = '请求参数有误', extra = {}) {
  return json({ error_code: code, error: message, ...extra }, status);
}

function now() {
  return new Date().toISOString();
}

/** 文本清洗：去首尾空格、超长截断，空字符串归一为 null */
function cleanText(value, maxLength) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

/** 磅数解析：'' / null / undefined 视为「未填写」 */
function parseTension(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
}

function b64encode(buffer) {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
  return btoa(out);
}

function b64decode(value) {
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** 长度恒定比较，避免通过响应时间猜口令 */
function constantTimeEqual(a, b) {
  const left = encoder.encode(String(a));
  const right = encoder.encode(String(b));
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index < 0) return;
    const key = part.slice(0, index).trim();
    if (!key) return;
    out[key] = decodeURIComponent(part.slice(index + 1).trim());
  });
  return out;
}

/* ------------------------------------------------------------------ *
 * 密码 / 会话
 * ------------------------------------------------------------------ */

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64encode(salt)}$${b64encode(bits)}`;
}

async function verifyPassword(password, stored) {
  try {
    const parts = String(stored).split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
    const iterations = Number(parts[1]);
    if (!Number.isFinite(iterations) || iterations <= 0) return false;
    const salt = b64decode(parts[2]);
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      key,
      256,
    );
    return constantTimeEqual(b64encode(bits), parts[3]);
  } catch {
    return false;
  }
}

function sessionSecret(env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 16) {
    throw new Error('服务器未配置 SESSION_SECRET（至少 32 位随机字符串）');
  }
  return encoder.encode(env.SESSION_SECRET);
}

async function issueSessionCookie(env, user, url) {
  const token = await new SignJWT({ uid: user.id, email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(sessionSecret(env));

  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

function clearSessionCookie(url) {
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

async function getSession(request, env) {
  const token = parseCookies(request.headers.get('cookie'))[SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(env));
    if (!payload || typeof payload.uid !== 'number') return null;
    return { id: payload.uid, email: String(payload.email || '') };
  } catch {
    return null;
  }
}

/** 展示用认领人邮箱：保留前缀前两位，其余打码 */
function maskEmail(email) {
  if (!email) return null;
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  return `${local.slice(0, Math.min(2, local.length))}***`;
}

/* ------------------------------------------------------------------ *
 * 天气（不阻塞主流程）
 * ------------------------------------------------------------------ */

async function fetchTemperature(latitude, longitude) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const endpoint = new URL('https://api.open-meteo.com/v1/forecast');
    endpoint.searchParams.set('latitude', String(latitude));
    endpoint.searchParams.set('longitude', String(longitude));
    endpoint.searchParams.set('current', 'temperature_2m');
    const response = await fetch(endpoint.toString(), { signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    const value = data?.current?.temperature_2m;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ *
 * 数据访问
 * ------------------------------------------------------------------ */

const RACKET_COLUMNS = `r.uuid, r.racket_brand, r.racket_model,
                        r.main_brand, r.main_model, r.main_tension,
                        r.cross_brand, r.cross_model, r.cross_tension,
                        r.strung_at, r.owner_id, r.claimed_at`;

function mapRacketRow(row) {
  return {
    uuid: row.uuid,
    racket_brand: row.racket_brand,
    racket_model: row.racket_model,
    main_brand: row.main_brand,
    main_model: row.main_model,
    main_tension: row.main_tension === null ? null : Number(row.main_tension),
    cross_brand: row.cross_brand,
    cross_model: row.cross_model,
    cross_tension: row.cross_tension === null ? null : Number(row.cross_tension),
    strung_at: row.strung_at,
    claimed: Boolean(row.owner_id),
    claimed_at: row.claimed_at,
  };
}

async function getRacket(env, uuid) {
  return env.DB.prepare(
    `SELECT ${RACKET_COLUMNS}, u.email AS owner_email_raw
       FROM rackets r
       LEFT JOIN users u ON u.id = r.owner_id
      WHERE r.uuid = ?`,
  )
    .bind(uuid)
    .first();
}

async function getLogs(env, uuid) {
  const result = await env.DB.prepare(
    `SELECT duration_hours, feedback, temperature_c, logged_at
       FROM usage_logs
      WHERE racket_uuid = ?
      ORDER BY logged_at DESC, id DESC
      LIMIT 200`,
  )
    .bind(uuid)
    .all();
  return result.results || [];
}

/* ------------------------------------------------------------------ *
 * 接口
 * ------------------------------------------------------------------ */

async function createRacket(request, env) {
  if (!env.ADMIN_TOKEN) return fail('SERVER_MISCONFIGURED', 500, '服务器未配置 ADMIN_TOKEN');

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('BAD_JSON', 400, '请求体必须是 JSON');
  }

  if (!constantTimeEqual(body?.admin_token ?? '', env.ADMIN_TOKEN)) {
    return fail('TOKEN_INVALID', 401, '后台口令错误');
  }

  // 兼容旧字段名（string_model / tension 视为主线）
  const racketBrand = cleanText(body?.racket_brand, 40);
  const racketModel = cleanText(body?.racket_model, 80);
  const mainBrand = cleanText(body?.main_brand, 40);
  const mainModel = cleanText(body?.main_model ?? body?.string_model, 80);
  const mainTension = parseTension(body?.main_tension ?? body?.tension);

  const crossBrand = cleanText(body?.cross_brand, 40);
  const crossModel = cleanText(body?.cross_model, 80);
  const crossTension = parseTension(body?.cross_tension);
  const isHybrid = Boolean(crossModel || crossTension !== null);

  if (!racketModel) return fail('RACKET_MODEL_REQUIRED', 400, '球拍型号必须填写');
  if (!mainModel) return fail('MAIN_STRING_REQUIRED', 400, '主（竖）线型号必须填写');
  if (mainTension === null) return fail('MAIN_TENSION_REQUIRED', 400, '主（竖）线磅数必须填写');
  if (!Number.isFinite(mainTension) || mainTension <= 0 || mainTension > MAX_TENSION) {
    return fail('MAIN_TENSION_INVALID', 400, `主（竖）线磅数必须是 0-${MAX_TENSION} 之间的数字`);
  }

  if (isHybrid) {
    if (!crossModel) return fail('CROSS_STRING_REQUIRED', 400, '子母线需要填写横线型号');
    if (crossTension === null) return fail('CROSS_TENSION_REQUIRED', 400, '子母线需要填写横线磅数');
    if (!Number.isFinite(crossTension) || crossTension <= 0 || crossTension > MAX_TENSION) {
      return fail('CROSS_TENSION_INVALID', 400, `横线磅数必须是 0-${MAX_TENSION} 之间的数字`);
    }
  }

  const uuid = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO rackets (uuid, racket_brand, racket_model,
                          main_brand, main_model, main_tension,
                          cross_brand, cross_model, cross_tension)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      uuid,
      racketBrand,
      racketModel,
      mainBrand,
      mainModel,
      mainTension,
      isHybrid ? crossBrand : null,
      isHybrid ? crossModel : null,
      isHybrid ? crossTension : null,
    )
    .run();

  return json({ uuid, strung_at: now() });
}

async function readRacket(request, env, url, uuid) {
  if (!UUID_RE.test(uuid)) return fail('RACKET_NOT_FOUND', 404, '球拍不存在');

  const racket = await getRacket(env, uuid);
  if (!racket) return fail('RACKET_NOT_FOUND', 404, '球拍不存在');

  const logs = await getLogs(env, uuid);

  return json({
    racket: { ...mapRacketRow(racket), owner_email: maskEmail(racket.owner_email_raw) },
    logs: logs.map((row) => ({
      duration_hours: Number(row.duration_hours),
      feedback: row.feedback,
      temperature_c: row.temperature_c === null ? null : Number(row.temperature_c),
      logged_at: row.logged_at,
    })),
    scan_url: `${url.origin}/r/${racket.uuid}`,
  });
}

async function createLog(request, env, uuid) {
  if (!UUID_RE.test(uuid)) return fail('RACKET_NOT_FOUND', 404, '球拍不存在');

  const racket = await getRacket(env, uuid);
  if (!racket) return fail('RACKET_NOT_FOUND', 404, '球拍不存在');

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('BAD_JSON', 400, '请求体必须是 JSON');
  }

  const duration = Number(body?.duration_hours);
  if (!Number.isFinite(duration) || duration <= 0) {
    return fail('DURATION_INVALID', 400, '使用时长必须是大于 0 的数字');
  }
  if (duration > 24) return fail('DURATION_TOO_LONG', 400, '单次使用时长不能超过 24 小时');

  const feedback = typeof body?.feedback === 'string' ? body.feedback.trim().slice(0, 500) : null;

  const latitude = Number(body?.latitude);
  const longitude = Number(body?.longitude);
  const hasCoords =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  const temperature = hasCoords ? await fetchTemperature(latitude, longitude) : null;
  const loggedAt = now();

  await env.DB.prepare(
    `INSERT INTO usage_logs (racket_uuid, duration_hours, feedback, temperature_c, logged_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(uuid, duration, feedback && feedback.length ? feedback : null, temperature, loggedAt)
    .run();

  return json({
    ok: true,
    log: {
      duration_hours: duration,
      feedback: feedback && feedback.length ? feedback : null,
      temperature_c: temperature,
      logged_at: loggedAt,
    },
  });
}

async function claimRacket(request, env, uuid) {
  const session = await getSession(request, env);
  if (!session) return fail('UNAUTHORIZED', 401, '请先登录');

  if (!UUID_RE.test(uuid)) return fail('RACKET_NOT_FOUND', 404, '球拍不存在');

  // 原子判断：只有 owner_id 仍为 NULL 才会写入，并发下第二个请求 changes=0
  const claimedAt = now();
  const result = await env.DB.prepare(
    `UPDATE rackets
        SET owner_id = ?, claimed_at = ?
      WHERE uuid = ? AND owner_id IS NULL`,
  )
    .bind(session.id, claimedAt, uuid)
    .run();

  if ((result?.meta?.changes ?? 0) > 0) return json({ ok: true, claimed_at: claimedAt });

  const racket = await getRacket(env, uuid);
  if (!racket) return fail('RACKET_NOT_FOUND', 404, '球拍不存在');
  return fail('CLAIM_TAKEN', 409, '这支球拍已被认领', { claimed: true });
}

async function listMyRackets(request, env) {
  const session = await getSession(request, env);
  if (!session) return fail('UNAUTHORIZED', 401, '请先登录');

  const result = await env.DB.prepare(
    `SELECT ${RACKET_COLUMNS},
            COALESCE(SUM(l.duration_hours), 0) AS total_hours,
            COUNT(l.id) AS log_count
       FROM rackets r
       LEFT JOIN usage_logs l ON l.racket_uuid = r.uuid
      WHERE r.owner_id = ?
      GROUP BY r.id
      ORDER BY r.claimed_at DESC`,
  )
    .bind(session.id)
    .all();

  return json({
    email: session.email,
    rackets: (result.results || []).map((row) => ({
      ...mapRacketRow(row),
      total_hours: Number(row.total_hours) || 0,
      log_count: Number(row.log_count) || 0,
    })),
  });
}

/** 本机记录（cookie / localStorage 里存下的球拍）批量查摘要，无需登录 */
async function lookupRackets(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail('BAD_JSON', 400, '请求体必须是 JSON');
  }

  const raw = Array.isArray(body?.uuids) ? body.uuids : [];
  const uuids = [...new Set(raw.filter((item) => typeof item === 'string' && UUID_RE.test(item)))].slice(0, 20);
  if (!uuids.length) return json({ rackets: [] });

  const placeholders = uuids.map(() => '?').join(', ');
  const result = await env.DB.prepare(
    `SELECT ${RACKET_COLUMNS},
            COALESCE(SUM(l.duration_hours), 0) AS total_hours,
            COUNT(l.id) AS log_count
       FROM rackets r
       LEFT JOIN usage_logs l ON l.racket_uuid = r.uuid
      WHERE r.uuid IN (${placeholders})
      GROUP BY r.id`,
  )
    .bind(...uuids)
    .all();

  return json({
    rackets: (result.results || []).map((row) => ({
      ...mapRacketRow(row),
      total_hours: Number(row.total_hours) || 0,
      log_count: Number(row.log_count) || 0,
    })),
  });
}

async function register(request, env, url) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail('BAD_JSON', 400, '请求体必须是 JSON');
  }

  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');

  if (!EMAIL_RE.test(email)) return fail('EMAIL_INVALID', 400, '邮箱格式不正确');
  if (password.length < 6) return fail('PASSWORD_SHORT', 400, '密码至少 6 位');
  if (password.length > 72) return fail('PASSWORD_LONG', 400, '密码过长');

  const passwordHash = await hashPassword(password);

  let inserted;
  try {
    inserted = await env.DB.prepare(
      `INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id, email`,
    )
      .bind(email, passwordHash)
      .first();
  } catch (error) {
    if (String(error?.message || error).toUpperCase().includes('UNIQUE')) {
      return fail('EMAIL_TAKEN', 409, '该邮箱已注册');
    }
    throw error;
  }

  const cookie = await issueSessionCookie(env, inserted, url);
  return json({ ok: true, email: inserted.email }, 201, { 'set-cookie': cookie });
}

async function login(request, env, url) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail('BAD_JSON', 400, '请求体必须是 JSON');
  }

  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  if (!email || !password) return fail('CREDENTIALS_REQUIRED', 400, '邮箱和密码都必须填写');

  const user = await env.DB.prepare(`SELECT id, email, password_hash FROM users WHERE email = ?`)
    .bind(email)
    .first();

  // 用户不存在与密码错误返回同一结果，避免被枚举邮箱
  if (!user) return fail('BAD_CREDENTIALS', 401, '邮箱或密码错误');
  if (!(await verifyPassword(password, user.password_hash))) {
    return fail('BAD_CREDENTIALS', 401, '邮箱或密码错误');
  }

  const cookie = await issueSessionCookie(env, user, url);
  return json({ ok: true, email: user.email }, 200, { 'set-cookie': cookie });
}

async function whoAmI(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ logged_in: false });
  return json({ logged_in: true, email: session.email });
}

async function qrcodeHandler(env, url) {
  const uuid = url.searchParams.get('uuid') || '';
  if (!UUID_RE.test(uuid)) return fail('UUID_INVALID', 400, 'uuid 不合法');

  const racket = await getRacket(env, uuid);
  if (!racket) return fail('RACKET_NOT_FOUND', 404, '球拍不存在');

  const scanUrl = `${url.origin}/r/${uuid}`;
  const qr = qrcode(0, 'M');
  qr.addData(scanUrl);
  qr.make();

  return json({ uuid, scan_url: scanUrl, data_url: qr.createDataURL(8, 4) });
}

/* ------------------------------------------------------------------ *
 * 路由
 * ------------------------------------------------------------------ */

async function handleApi(request, env, url) {
  const path = url.pathname;
  const method = request.method;

  if (path === '/api/health') return json({ ok: true });
  if (path === '/api/me' && method === 'GET') return whoAmI(request, env);
  if (path === '/api/qrcode' && method === 'GET') return qrcodeHandler(env, url);
  if (path === '/api/my' && method === 'GET') return listMyRackets(request, env);
  if (path === '/api/rackets' && method === 'POST') return createRacket(request, env);
  if (path === '/api/rackets/lookup' && method === 'POST') return lookupRackets(request, env);

  if (path === '/api/auth/register' && method === 'POST') return register(request, env, url);
  if (path === '/api/auth/login' && method === 'POST') return login(request, env, url);
  if (path === '/api/auth/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie(url) });
  }

  const match = path.match(/^\/api\/rackets\/([^/]+)(?:\/(logs|claim))?$/);
  if (match) {
    const uuid = decodeURIComponent(match[1]);
    const action = match[2];
    if (!action && method === 'GET') return readRacket(request, env, url, uuid);
    if (action === 'logs' && method === 'POST') return createLog(request, env, uuid);
    if (action === 'claim' && method === 'POST') return claimRacket(request, env, uuid);
    return fail('METHOD_NOT_ALLOWED', 405, '方法不被允许');
  }

  return fail('NOT_FOUND', 404, '接口不存在');
}

async function handlePage(request, env, url) {
  const path = url.pathname;

  // html_handling = "none" 下必须显式映射干净路径
  const pages = {
    '/': '/index.html',
    '/login': '/login.html',
    '/my': '/my.html',
    '/local': '/local.html',
  };

  const target = path === '/r' || path.startsWith('/r/') ? '/r.html' : pages[path];
  if (!target) return env.ASSETS.fetch(request);

  const assetUrl = new URL(url.toString());
  assetUrl.pathname = target;
  return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (error) {
        console.error('api_error', url.pathname, error?.stack || error);
        return fail('INTERNAL', 500, '服务器内部错误');
      }
    }

    return handlePage(request, env, url);
  },
};
