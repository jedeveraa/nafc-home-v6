// Menu toggle: below 1280px the header nav collapses into a panel under the bar.
(() => {
  const header = document.querySelector('.site-header');
  const toggle = header && header.querySelector('.menu-toggle');
  if (!toggle) return;

  const setOpen = (open) => {
    header.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  toggle.addEventListener('click', () => setOpen(!header.classList.contains('is-open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  window.matchMedia('(min-width: 1280px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
})();
