const catalogList = document.getElementById('catalog-list');
const catalogMsg = document.getElementById('catalog-msg');
const brandForm = document.getElementById('brand-form');
const modelForm = document.getElementById('model-form');
const brandSelect = document.getElementById('model-brand');
const ratingKeys = ['power', 'control', 'spin', 'durability'];
let catalog = { brands: [], models: [] };
let canEdit = false;

const ratingFields = document.getElementById('rating-fields');
ratingKeys.forEach((key) => {
  const field = document.createElement('div');
  field.className = 'field';
  const label = document.createElement('label');
  label.htmlFor = `rating-${key}`;
  label.textContent = t(`catalog.${key}`);
  const select = document.createElement('select');
  select.className = 'select';
  select.id = label.htmlFor;
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
  field.append(label, select);
  ratingFields.appendChild(field);
});

function renderCatalog() {
  const selectedBrand = brandSelect.value;
  brandSelect.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = t('catalog.chooseBrand');
  brandSelect.appendChild(placeholder);
  catalog.brands.filter((brand) => brand.kind === 'string').forEach((brand) => {
    const option = document.createElement('option');
    option.value = String(brand.id);
    option.textContent = brand.name;
    brandSelect.appendChild(option);
  });
  brandSelect.value = selectedBrand || '';

  if (!catalog.models.length) {
    catalogList.textContent = t('catalog.empty');
    return;
  }
  catalogList.innerHTML = catalog.models.map((model) => `
    <div class="catalog-item">
      <strong>${escapeHtml(model.brand)} · ${escapeHtml(model.name)}</strong>
      <div class="item-meta">${ratingKeys.map((key) =>
    `${escapeHtml(t(`catalog.${key}`))}: ${model[key] === null ? escapeHtml(t('catalog.unrated')) : `${model[key]} / 5`}`
  ).join(' · ')}</div>
      ${canEdit ? `<button type="button" class="link-btn" data-edit-model="${model.id}">${escapeHtml(t('catalog.edit'))}</button>` : ''}
    </div>`).join('');
}

async function loadCatalog() {
  try {
    const res = await api('/api/catalog');
    if (!res.ok) {
      showMessage(catalogMsg, errText(res.data));
      return false;
    }
    catalog = res.data;
    hideMessage(catalogMsg);
    renderCatalog();
    return true;
  } catch {
    showMessage(catalogMsg, t('msg.netError'));
    return false;
  }
}

async function loadCatalogIdentity() {
  try {
    const res = await api('/api/me');
    if (!res.ok) {
      showMessage(catalogMsg, errText(res.data));
      return;
    }
    canEdit = Boolean(res.data.is_stringer);
    document.getElementById('catalog-admin').hidden = !canEdit;
    document.getElementById('catalog-signin').hidden = canEdit;
    renderCatalog();
  } catch {
    showMessage(catalogMsg, t('msg.netError'));
  }
}

catalogList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-edit-model]');
  if (!button || !canEdit) return;
  const model = catalog.models.find((item) => item.id === Number(button.dataset.editModel));
  if (!model) return;
  brandSelect.value = String(model.brand_id);
  document.getElementById('model-name').value = model.name;
  ratingKeys.forEach((key) => {
    document.getElementById(`rating-${key}`).value = model[key] === null ? '' : String(model[key]);
  });
  modelForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('model-name').focus();
});

async function saveCatalogForm(form, path, payload, message, onSuccess) {
  hideMessage(message);
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const res = await api(path, { method: 'POST', body: JSON.stringify(payload) });
    if (!res.ok) {
      showMessage(message, errText(res.data));
      return;
    }
    onSuccess();
    showMessage(message, t('catalog.saved'), 'ok');
    await loadCatalog();
  } catch {
    showMessage(message, t('msg.netError'));
  } finally {
    button.disabled = false;
  }
}

brandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveCatalogForm(brandForm, '/api/catalog/brands', {
    kind: document.getElementById('brand-kind').value,
    name: document.getElementById('brand-name').value.trim(),
  }, document.getElementById('brand-msg'), () => {
    document.getElementById('brand-name').value = '';
  });
});

modelForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const payload = {
    brand_id: Number(brandSelect.value),
    name: document.getElementById('model-name').value.trim(),
  };
  ratingKeys.forEach((key) => {
    const value = document.getElementById(`rating-${key}`).value;
    payload[key] = value === '' ? null : Number(value);
  });
  saveCatalogForm(modelForm, '/api/catalog/models', payload, document.getElementById('model-msg'), () => {
    modelForm.reset();
  });
});

loadCatalog().then(loadCatalogIdentity);
