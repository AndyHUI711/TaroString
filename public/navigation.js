function mountNavigation() {
  const topbar = document.querySelector('.topbar');
  const nav = topbar && topbar.querySelector('nav');
  if (!nav) return;

  nav.id = 'site-navigation';
  nav.setAttribute('aria-label', t('nav.navigation'));

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'nav-toggle';
  button.setAttribute('aria-label', t('nav.menu'));
  button.setAttribute('aria-controls', nav.id);
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML = '<span></span><span></span><span></span>';
  topbar.insertBefore(button, nav);
  topbar.classList.add('nav-ready');

  function setOpen(open, restoreFocus = false) {
    topbar.classList.toggle('nav-open', open);
    button.setAttribute('aria-expanded', String(open));
    if (restoreFocus) button.focus();
  }

  button.addEventListener('click', () => setOpen(!topbar.classList.contains('nav-open')));
  document.addEventListener('click', (event) => {
    if (topbar.classList.contains('nav-open') && !topbar.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && topbar.classList.contains('nav-open')) {
      setOpen(false, true);
    }
  });
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a') && topbar.classList.contains('nav-open')) setOpen(false, true);
  });
  window.matchMedia('(max-width: 720px)').addEventListener('change', () => setOpen(false));
}

document.addEventListener('DOMContentLoaded', mountNavigation);
