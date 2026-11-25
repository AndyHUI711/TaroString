/**
 * 可重複使用的「新功能」提示元件。
 *
 * 用 localStorage 記住看過的 id，每個 id 只會顯示一次（跨頁面、跨整理都算一次）。
 * 需要 i18n.js（用 t 翻譯 title / description / button；沒有對應 key 時直接用原字串）。
 *
 * 用法：
 *   mountWhatsNew({
 *     id: 'string-catalog',        // 唯一識別，決定「只顯示一次」
 *     title: 'wn.catalogTitle',    // i18n key 或純文字
 *     description: 'wn.catalogDesc',
 *     button: 'wn.catalogBtn',
 *     href: '/catalog',            // 點擊按鈕後前往
 *     badge: 'wn.badge',           // 選填，卡片左上角小標籤
 *   });
 */
(function () {
  function esc(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  // i18n key 有對應翻譯就用翻譯，否則當成純文字
  function resolve(value) {
    if (value === null || value === undefined || value === '') return '';
    if (typeof window.t === 'function') {
      const translated = window.t(value);
      if (translated !== value) return translated;
    }
    return String(value);
  }

  function mount(options) {
    const opts = options || {};
    if (!opts.id) return;

    const storageKey = `wn_seen_${opts.id}`;
    let seen = false;
    try {
      seen = window.localStorage.getItem(storageKey) === '1';
    } catch (error) {
      seen = false;
    }
    if (seen) return;

    const build = () => {
      const host = document.querySelector('main.wrap') || document.body;
      if (!host || host.querySelector('.whatsnew')) return;

      const title = resolve(opts.title);
      const card = document.createElement('section');
      card.className = 'card whatsnew';
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-label', title || 'What is new');

      const badge = opts.badge ? `<span class="badge ok wn-badge">${esc(resolve(opts.badge))}</span>` : '';

      card.innerHTML = `
        <button type="button" class="wn-close" aria-label="close">×</button>
        ${badge}
        <h2 class="wn-title">${esc(title)}</h2>
        <p class="wn-desc">${esc(resolve(opts.description))}</p>
        <a class="btn wn-cta" href="${esc(opts.href || '#')}">${esc(resolve(opts.button))}</a>
      `;

      const markSeen = () => {
        try {
          window.localStorage.setItem(storageKey, '1');
        } catch (error) {
          /* 隐私模式下寫入失敗也無妨，重新整理才會再出現 */
        }
      };

      card.querySelector('.wn-close').addEventListener('click', () => {
        markSeen();
        card.remove();
      });
      card.querySelector('.wn-cta').addEventListener('click', markSeen);

      host.insertBefore(card, host.firstChild);
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
    else build();
  }

  window.mountWhatsNew = mount;
})();