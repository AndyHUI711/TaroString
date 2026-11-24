const searchForm = document.getElementById('search-form');
const searchKeyword = document.getElementById('search-keyword');
const searchMaterial = document.getElementById('search-material');
const searchMinOverall = document.getElementById('search-min-overall');
const searchMsg = document.getElementById('search-msg');
const searchResult = document.getElementById('search-result');
const searchCount = document.getElementById('search-count');
const searchList = document.getElementById('search-list');

const STAR_KEYS = [
  'comfort', 'tension_retention', 'power', 'spin', 'feel', 'control_v2', 'overall',
];

function stars(value) {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1 || n > 5) return '—';
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function starRow(label, key, value) {
  return `<div class="star-row">
    <span class="star-label">${escapeHtml(label)}</span>
    <span class="star-value">${stars(value)}</span>
  </div>`;
}

function renderString(s) {
  const brand = (s.name || '').split(/\s+/)[0] || '';
  const model = (s.name || '').slice(brand.length).trim();
  const rows = [
    starRow(t('search.comfort'), 'comfort', s.comfort),
    starRow(t('search.tensionRetention'), 'tension_retention', s.tension_retention),
    starRow(t('search.power'), 'power', s.power),
    starRow(t('search.spin'), 'spin', s.spin),
    starRow(t('search.feel'), 'feel', s.feel),
    starRow(t('search.control'), 'control_v2', s.control_v2),
    starRow(t('search.overall'), 'overall', s.overall),
  ];
  return `
    <div class="search-item">
      <div class="search-head">
        <strong>${escapeHtml(s.name)}</strong>
        ${s.material ? `<span class="badge">${escapeHtml(s.material)}</span>` : ''}
      </div>
      <div class="search-meta">
        ${s.gauge ? `${t('search.gauge')} ${Number(s.gauge).toFixed(2)} mm` : ''}${s.test_lbs ? ` · ${t('search.testLbs')} ${Number(s.test_lbs).toFixed(0)} lbs` : ''}${s.stiffness ? ` · ${t('search.stiffness')} ${Number(s.stiffness).toFixed(1)}` : ''}
      </div>
      <div class="search-stars">${rows.join('')}</div>
      <div class="search-extra">
        ${s.tension_loss != null ? `${t('search.tensionLoss')} ${Number(s.tension_loss).toFixed(1)}%` : ''}
        ${s.energy_return != null ? ` · ${t('search.energyReturn')} ${Number(s.energy_return).toFixed(1)}%` : ''}
        ${s.spin_potential != null ? ` · ${t('search.spinPotential')} ${Number(s.spin_potential).toFixed(1)}` : ''}
        ${s.s2s_cof != null ? ` · ${t('search.s2sCOF')} ${Number(s.s2s_cof).toFixed(3)}` : ''}
        ${s.s2b_cof != null ? ` · ${t('search.s2bCOF')} ${Number(s.s2b_cof).toFixed(3)}` : ''}
      </div>
    </div>`;
}

async function loadMaterials() {
  try {
    const all = await api('/api/catalog/strings', { method: 'POST', body: JSON.stringify({ keyword: '', limit: 2000 }) });
    if (!all.ok) return;
    const materials = [...new Set((all.data.strings || []).map((s) => s.material).filter(Boolean))];
    searchMaterial.innerHTML = `<option value="" data-i18n="search.materialAll">全部材質</option>` +
      materials.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  } catch {
    /* 忽略 */
  }
}

searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideMessage(searchMsg);
  const payload = {
    keyword: searchKeyword.value.trim(),
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
    searchResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch {
    showMessage(searchMsg, t('msg.netError'));
  }
});

loadMaterials();