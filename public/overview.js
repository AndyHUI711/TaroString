const overviewMsg = document.getElementById('overview-msg');
const overviewContent = document.getElementById('overview-content');
const overviewGate = document.getElementById('overview-gate');
const offsetForm = document.getElementById('offset-form');
const offsetInput = document.getElementById('offset');
const offsetMsg = document.getElementById('offset-msg');

function renderBrands(element, brands) {
  if (!brands.length) {
    element.textContent = t('overview.empty');
    return;
  }
  element.innerHTML = brands.map((row) => `
    <div class="item"><div class="item-title">
      <strong>${escapeHtml(row.brand || t('overview.unknown'))}</strong>
      <span class="item-side">${escapeHtml(t('overview.jobCount', { n: row.jobs }))}</span>
    </div></div>`).join('');
}

function renderBarChart(container, rows, labelKey, valueKey) {
  if (!rows.length) {
    container.innerHTML = `<p class="hint">${escapeHtml(t('overview.empty'))}</p>`;
    return;
  }
  const max = Math.max(...rows.map((r) => Number(r[valueKey]) || 0), 1);
  const bars = rows.map((r) => {
    const label = escapeHtml(r[labelKey] || t('overview.unknown'));
    const value = Number(r[valueKey]) || 0;
    const width = Math.round((value / max) * 100);
    return `
      <div class="bar-row">
        <div class="bar-label"><span class="bar-name">${label}</span><span class="bar-val">${value}</span></div>
        <div class="bar-track"><i style="width:${width}%"></i></div>
      </div>`;
  }).join('');
  container.innerHTML = `<div class="bar-chart">${bars}</div>`;
}

function renderOverview(data) {
  document.getElementById('lifetime-jobs').textContent = data.lifetime_jobs;
  document.getElementById('recorded-jobs').textContent = data.recorded_jobs;
  document.getElementById('recorded-rackets').textContent = data.recorded_rackets;
  document.getElementById('historical-count').textContent = data.historical_count;
  offsetInput.value = data.offset_configured ? data.historical_count : 65;
  renderBarChart(document.getElementById('monthly-chart'), data.monthly || [], 'month', 'jobs');
  const topRows = (data.top_rackets || []).map((r) => ({
    label: [r.brand, r.model].filter(Boolean).join(' ') || t('overview.unknown'),
    jobs: Number(r.jobs) || 0,
  }));
  renderBarChart(document.getElementById('top-chart'), topRows, 'label', 'jobs');
  renderBrands(document.getElementById('racket-brands'), data.racket_brands);
  renderBrands(document.getElementById('string-brands'), data.string_brands);
  const recent = document.getElementById('recent-jobs');
  if (!data.recent_jobs.length) {
    recent.textContent = t('overview.empty');
    return;
  }
  recent.innerHTML = data.recent_jobs.map((job) => {
    const racket = [job.racket_brand, job.racket_model].filter(Boolean).join(' ');
    const main = [job.main_brand, job.main_model].filter(Boolean).join(' ');
    const cross = job.cross_model ? [job.cross_brand, job.cross_model].filter(Boolean).join(' ') : '';
    return `<a class="item" href="/r/${encodeURIComponent(job.uuid)}">
      <div class="item-title"><strong>${escapeHtml(racket)}</strong><span class="item-side">${escapeHtml(fmtDateShort(job.strung_at))}</span></div>
      <div class="item-meta">${escapeHtml([main, cross].filter(Boolean).join(' / '))}</div>
    </a>`;
  }).join('');
}

async function loadOverview() {
  try {
    const res = await api('/api/overview');
    if (res.status === 403) {
      overviewContent.hidden = true;
      overviewGate.hidden = false;
      return false;
    }
    if (!res.ok) {
      showMessage(overviewMsg, errText(res.data));
      return false;
    }
    hideMessage(overviewMsg);
    overviewGate.hidden = true;
    overviewContent.hidden = false;
    renderOverview(res.data);
    return true;
  } catch {
    showMessage(overviewMsg, t('msg.netError'));
    return false;
  }
}

offsetForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideMessage(offsetMsg);
  const button = offsetForm.querySelector('button');
  button.disabled = true;
  try {
    const res = await api('/api/overview', {
      method: 'PUT',
      body: JSON.stringify({ historical_count: Number(offsetInput.value) }),
    });
    if (!res.ok) {
      showMessage(offsetMsg, errText(res.data));
      return;
    }
    showMessage(offsetMsg, t('overview.saved'), 'ok');
    await loadOverview();
  } catch {
    showMessage(offsetMsg, t('msg.netError'));
  } finally {
    button.disabled = false;
  }
});

loadOverview();
