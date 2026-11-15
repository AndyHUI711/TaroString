/**
 * 线型号的建议项和品牌控件。
 *
 * 全部是「建议值」而不是约束：品牌下拉最后一项是「其他品牌…」，选中后可以自己输入；
 * 线型号输入框带 datalist，既能选常用型号，也能直接手打新型号。
 * 品牌来自数据库；历史线型号建议仍可自由输入。
 */

// 常用线型号，仅作输入建议（datalist）
const STRING_MODELS = [
  'ALU Power 1.25',
  'ALU Power 1.30',
  'ALU Power Rough 1.25',
  'ALU Power Soft 1.25',
  '4G 1.25',
  '4G Soft 1.25',
  'Element 1.25',
  'RPM Blast 1.20',
  'RPM Blast 1.25',
  'RPM Blast 1.30',
  'RPM Blast Rough 1.25',
  'RPM Team 1.25',
  'X-One Biphase 1.24',
  'Xcel 1.25',
  'Natural Gut VS 1.30',
  'Tour Bite 1.20',
  'Tour Bite 1.25',
  'Tour Bite Soft 1.25',
  'Hyper-G 1.15',
  'Hyper-G 1.20',
  'Hyper-G 1.25',
  'Confidential 1.25',
  'NXT 1.24',
  'Sensation 1.30',
  'Champion’s Choice',
  'Poly Tour Pro 1.25',
  'Poly Tour Spin 1.25',
  'Poly Tour Rev 1.25',
  'Rexis Speed 1.25',
  'Velocity MLT 1.25',
  'Black Code 1.24',
  'Multifeel 1.25',
  'NRG2 1.32',
  'Synthetic Gut 1.30',
  'Pro Hurricane 1.25',
  'Max Power 1.25',
  'Pro Line II 1.25',
  'Cyclone 1.25',
  'V-Torque 1.25',
  'MSV Focus Hex 1.23',
  'Signum Pro Poly Plasma 1.23',
  'Taan 5600 1.15'
];

/**
 * 生成「品牌下拉 + 其他品牌手输」的组合控件。
 * 返回 { get(), set(value), element }
 */
function createBrandField(options) {
  const { placeholder, otherLabel, value } = options;
  let brands = options.brands;

  const wrap = document.createElement('div');
  wrap.className = 'brand-field';

  const select = document.createElement('select');
  select.className = 'select';

  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = placeholder;
  select.appendChild(empty);

  const otherOption = document.createElement('option');
  otherOption.value = '__other__';
  otherOption.textContent = otherLabel;

  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 40;
  input.className = 'brand-custom';
  input.hidden = true;

  wrap.append(select, input);

  select.addEventListener('change', () => {
    input.hidden = select.selectedOptions[0] !== otherOption;
    if (!input.hidden) input.focus();
  });

  function set(next) {
    if (!next) {
      select.value = '';
      input.hidden = true;
      input.value = '';
      return;
    }
    if (brands.includes(next)) {
      select.value = next;
      input.hidden = true;
      input.value = '';
    } else {
      otherOption.selected = true;
      input.hidden = false;
      input.value = next;
    }
  }

  function get() {
    if (select.selectedOptions[0] === otherOption) return input.value.trim();
    return select.value;
  }

  function setBrands(next) {
    const current = get();
    brands = next;
    select.replaceChildren(empty);
    brands.forEach((brand) => {
      const option = document.createElement('option');
      option.value = brand;
      option.textContent = brand;
      select.appendChild(option);
    });
    select.appendChild(otherOption);
    set(current);
  }

  setBrands(brands);
  if (value) set(value);

  return { element: wrap, get, set, setBrands };
}

/** 给指定 id 的 input 挂上共用 datalist */
function attachDatalist(inputId, listId, values) {
  let list = document.getElementById(listId);
  if (!list) {
    list = document.createElement('datalist');
    list.id = listId;
    document.body.appendChild(list);
  }
  list.innerHTML = values.map((item) => `<option value="${escapeHtml(item)}"></option>`).join('');

  const input = document.getElementById(inputId);
  if (input) input.setAttribute('list', listId);
}
