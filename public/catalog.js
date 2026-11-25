const searchForm = document.getElementById('search-form');
const searchKeyword = document.getElementById('search-keyword');
const searchBrand = document.getElementById('search-brand');
const searchMaterial = document.getElementById('search-material');
const searchMinOverall = document.getElementById('search-min-overall');
const nameList = document.getElementById('string-names');
const searchMsg = document.getElementById('catalog-msg');
const searchResult = document.getElementById('search-result');
const searchCount = document.getElementById('search-count');
const searchList = document.getElementById('search-list');

const stringForm = document.getElementById('string-form');
const stringMsg = document.getElementById('string-msg');
const stringReset = document.getElementById('string-reset');
const ratingFields = document.getElementById('rating-fields');

const STAR_FIELDS = [
  { key: 'comfort', label: 'search.comfort' },
  { key: 'tension_retention', label: 'search.tensionRetention' },
  { key: 'power', label: 'search.power' },
  { key: 'spin', label: 'search.spin' },
  { key: 'feel', label: 'search.feel' },
  { key: 'control_v2', label: 'search.control' },
  { key: 'overall', label: 'search.overall' },
  { key: 'ss_cof_rating', label: 'search.s2sCOF' },
  { key: 'sb_cof_rating', label: 'search.s2bCOF' },
];

const NUMERIC_FIELDS = [
  'gauge', 'test_lbs', 'stiffness', 'tension_loss',
  'energy_return', 'spin_potential', 's2s_cof', 's2b_cof',
];

let canEdit = false;
let allStrings = [];

/* -------------------- 星級評分下拉（管理表單） -------------------- */

STAR_FIELDS.forEach(({ key, label }) => {
  const field = document.createElement('div');
  field.className = 'field';
  const labelEl = document.createElement('label');
  labelEl.htmlFor = `s-${key}`;
  labelEl.textContent = t(label);
  const select = document.createElement('select');
  select.className = 'select';
  select.id = labelEl.htmlFor;
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = t('catalog.unrated');
  select.appendChild(empty);
  for (let value = 1; value <= 5; value += 1) {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = `${value} / 5`;
    select.appendChild(option);
  }
  field.append(labelEl, select);
  ratingFields.appendChild(field);
});

/* -------------------- 星級 / 內容渲染 -------------------- */

function stars(value) {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 5) return '—';
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function starRow(label, value) {
  return `<div class="star-row">
    <span class="star-label">${escapeHtml(label)}</span>
    <span class="star-value">${stars(value)}</span>
  </div>`;
}

function brandOf(name) {
  return (name || '').split(/\s+/)[0] || '';
}

function renderString(s) {
  const rows = [
    starRow(t('search.comfort'), s.comfort),
    starRow(t('search.tensionRetention'), s.tension_retention),
    starRow(t('search.power'), s.power),
    starRow(t('search.spin'), s.spin),
    starRow(t('search.feel'), s.feel),
    starRow(t('search.control'), s.control_v2),
    starRow(t('search.overall'), s.overall),
  ];
  const meta = [
    s.gauge ? `${t('search.gauge')} ${Number(s.gauge).toFixed(2)} mm` : '',
    s.test_lbs ? `${t('search.testLbs')} ${Number(s.test_lbs).toFixed(0)} lbs` : '',
    s.stiffness ? `${t('search.stiffness')} ${Number(s.stiffness).toFixed(1)}` : '',
  ].filter(Boolean).join(' · ');
  const extra = [
    s.tension_loss != null ? `${t('search.tensionLoss')} ${Number(s.tension_loss).toFixed(1)}%` : '',
    s.energy_return != null ? `${t('search.energyReturn')} ${Number(s.energy_return).toFixed(1)}%` : '',
    s.spin_potential != null ? `${t('search.spinPotential')} ${Number(s.spin_potential).toFixed(1)}` : '',
    s.s2s_cof != null ? `${t('search.s2sCOF')} ${Number(s.s2s_cof).toFixed(3)}` : '',
    s.s2b_cof != null ? `${t('search.s2bCOF')} ${Number(s.s2b_cof).toFixed(3)}` : '',
  ].filter(Boolean).join(' · ');
  return `
    <div class="search-item">
      <div class="search-head">
        <strong>${escapeHtml(s.name)}</strong>
        ${s.material ? `<span class="badge">${escapeHtml(s.material)}</span>` : ''}
        ${canEdit ? `<button type="button" class="link-btn" data-edit-string="${escapeHtml(s.name)}">${escapeHtml(t('catalog.editString'))}</button>` : ''}
      </div>
      ${meta ? `<div class="search-meta">${meta}</div>` : ''}
      <div class="search-stars">${rows.join('')}</div>
      ${extra ? `<div class="search-extra">${extra}</div>` : ''}
    </div>`;
}

/* -------------------- 下拉 / datalist 選項 -------------------- */

function fillSelect(select, values, allLabel) {
  const current = select.value;
  select.replaceChildren();
  const first = document.createElement('option');
  first.value = '';
  first.textContent = allLabel;
  select.appendChild(first);
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  select.value = current;
}

function refreshOptions() {
  const materials = [...new Set(allStrings.map((s) => s.material).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const brands = [...new Set(allStrings.map((s) => brandOf(s.name)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  fillSelect(searchMaterial, materials, t('search.materialAll'));
  fillSelect(searchBrand, brands, t('search.brandAll'));
  nameList.innerHTML = allStrings
    .map((s) => `<option value="${escapeHtml(s.name)}"></option>`)
    .join('');
}

/* -------------------- 資料載入 -------------------- */

async function loadAllStrings() {
  try {
    const res = await api('/api/catalog/strings', { method: 'POST', body: JSON.stringify({ keyword: '', limit: 2000 }) });
    if (res.ok) {
      allStrings = res.data.strings || [];
      refreshOptions();
    }
  } catch {
    /* 忽略：下拉選項少一點不影響搜尋 */
  }
}

async function loadIdentity() {
  try {
    const res = await api('/api/me');
    if (!res.ok) return;
    canEdit = Boolean(res.data.is_stringer);
    document.getElementById('catalog-admin').hidden = !canEdit;
    document.getElementById('catalog-signin').hidden = canEdit;
  } catch {
    /* 忽略 */
  }
}

/* -------------------- 搜尋 -------------------- */

async function runSearch() {
  hideMessage(searchMsg);
  const payload = {
    keyword: searchKeyword.value.trim(),
    brand: searchBrand.value,
    material: searchMaterial.value,
    min_overall: searchMinOverall.value ? Number(searchMinOverall.value) : null,
    limit: 200,
  };
  try {
    const res = await api('/api/catalog/strings', { method: 'POST', body: JSON.stringify(payload) });
    if (!res.ok) {
      showMessage(searchMsg, errText(res.data));
      return;
    }
    const strings = res.data.strings || [];
    searchResult.hidden = false;
    searchCount.textContent = t('search.count', { n: strings.length });
    if (!strings.length) {
      searchList.innerHTML = `<p class="hint">${escapeHtml(t('search.empty'))}</p>`;
      return;
    }
    searchList.innerHTML = strings.map(renderString).join('');
  } catch {
    showMessage(searchMsg, t('msg.netError'));
  }
}

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  runSearch();
});

/* -------------------- 穿線師：新增 / 調整球線 -------------------- */

function fillForm(s) {
  document.getElementById('s-name').value = s.name || '';
  document.getElementById('s-material').value = s.material || '';
  NUMERIC_FIELDS.forEach((key) => {
    const el = document.getElementById(`s-${key}`);
    const value = s[key];
    el.value = value === null || value === undefined ? '' : String(value);
  });
  STAR_FIELDS.forEach(({ key }) => {
    const value = s[key];
    document.getElementById(`s-${key}`).value = value === null || value === undefined ? '' : String(value);
  });
}

function resetForm() {
  stringForm.reset();
  hideMessage(stringMsg);
}

stringReset.addEventListener('click', resetForm);

searchList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-edit-string]');
  if (!button || !canEdit) return;
  const name = button.dataset.editString;
  const found = allStrings.find((item) => item.name === name);
  if (!found) return;
  fillForm(found);
  stringForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('s-name').focus();
});

stringForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideMessage(stringMsg);
  const payload = { name: document.getElementById('s-name').value.trim() };
  if (!payload.name) {
    showMessage(stringMsg, t('err.CATALOG_NAME_INVALID'));
    return;
  }
  const material = document.getElementById('s-material').value.trim();
  if (material) payload.material = material;
  NUMERIC_FIELDS.forEach((key) => {
    const raw = document.getElementById(`s-${key}`).value.trim();
    if (raw !== '') payload[key] = Number(raw);
  });
  STAR_FIELDS.forEach(({ key }) => {
    const raw = document.getElementById(`s-${key}`).value;
    payload[key] = raw === '' ? null : Number(raw);
  });

  const button = stringForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const res = await api('/api/catalog/strings/save', { method: 'POST', body: JSON.stringify(payload) });
    if (!res.ok) {
      showMessage(stringMsg, errText(res.data));
      return;
    }
    showMessage(stringMsg, t('catalog.saved'), 'ok');
    await loadAllStrings();
    await runSearch();
  } catch {
    showMessage(stringMsg, t('msg.netError'));
  } finally {
    button.disabled = false;
  }
});

loadAllStrings().then(loadIdentity).then(runSearch);