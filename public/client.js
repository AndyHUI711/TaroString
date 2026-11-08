/**
 * 前端公共逻辑：接口调用 + 「本机球拍」的浏览器留存 + 定位 + 提示
 *
 * 本机留存：客户扫过一次球拍后不必再保存二维码链接，打开站点就能在「本机球拍」里找到。
 * 数据完全存在浏览器里，不需要账号。localStorage 存展示信息，cookie 存 uuid 列表当兜底。
 *
 * 文案格式化与语言切换在 i18n.js（需先加载）。
 */

const STORE_KEY = 'rl_rackets_v1';
const COOKIE_KEY = 'rl_rackets';
const MAX_RACKETS = 30;

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    ...options,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { ok: response.ok, status: response.status, data: data || {} };
}

/* ------------------------------ 本机留存 ------------------------------ */

function readStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.uuid) : [];
  } catch {
    return [];
  }
}

function readCookieUuids() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]*)`));
  if (!match) return [];
  return decodeURIComponent(match[1]).split('|').filter(Boolean);
}

function writeStore(list) {
  const trimmed = list.slice(0, MAX_RACKETS);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(trimmed));
  } catch {
    // 隐私模式下可能写入失败，cookie 兜底仍然有效
  }
  const uuids = trimmed.map((item) => item.uuid).join('|');
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(uuids)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

/** 记下这支球拍（同一 uuid 去重，最近访问排前面） */
function rememberRacket(uuid, model) {
  if (!uuid) return [];
  const list = readStore().filter((item) => item.uuid !== uuid);
  list.unshift({ uuid, model: model || '', savedAt: new Date().toISOString() });
  writeStore(list);
  return list;
}

function forgetRacket(uuid) {
  writeStore(readStore().filter((item) => item.uuid !== uuid));
}

/** 合并 localStorage 与 cookie 两处记录，cookie 里多出来的用空型号占位 */
function listLocalRackets() {
  const local = readStore();
  const known = new Set(local.map((item) => item.uuid));
  const extra = readCookieUuids()
    .filter((uuid) => !known.has(uuid))
    .map((uuid) => ({ uuid, model: '', savedAt: null }));
  return [...local, ...extra].slice(0, MAX_RACKETS);
}

function clearLocalRackets() {
  writeStore([]);
  document.cookie = `${COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* noop */
  }
}

/* ------------------------------ 定位 ------------------------------ */

/**
 * 取浏览器定位，5 秒超时。
 * 任何失败（拒绝授权 / 不支持 / 超时）都返回 null —— 调用方据此跳过温度，但记录照常提交。
 */
function getPosition(timeoutMs = 5000) {
  if (!('geolocation' in navigator)) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (position) => finish({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => finish(null),
      { timeout: timeoutMs, maximumAge: 5 * 60 * 1000, enableHighAccuracy: false },
    );
  });
}

/* ------------------------------ 提示 ------------------------------ */

function showMessage(element, text, kind = 'error') {
  if (!element) return;
  element.textContent = text;
  element.className = `msg show ${kind}`;
}

function showError(element, data) {
  showMessage(element, errText(data), 'error');
}

function hideMessage(element) {
  if (!element) return;
  element.className = 'msg';
}
