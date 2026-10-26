/* motion-core.js — generic motion layer for pixel-matched builds (xd-motion skill)
   Copy into the project as-is. Load with `defer` BEFORE the project's main.js.
   Everything is driven by data attributes; project-specific interactions go in main.js and use window.Motion.
   Runs only when <html> has the "js" class (see head-snippet.html). */
(() => {
  const root = document.documentElement;
  if (!root.classList.contains('js')) return;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  /* commit the start state so the next class change transitions.
     Never use requestAnimationFrame for this: rAF stalls in hidden tabs and the element stays hidden. */
  const flush = (el) => void el.getBoundingClientRect();
  const hooks = [];

  /* ---------- word splitter (keeps <br> and inline tags) ---------- */
  const splitWords = (el) => {
    const words = [];
    const walk = (node) => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement('span'), i = document.createElement('span');
            w.className = 'w'; i.className = 'w__i'; i.textContent = part;
            w.appendChild(i); frag.appendChild(w); words.push(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(el);
    return words;
  };

  /* masked words, numbered by line (--li) and position in line (--wi) so each line rises together */
  const splitHeading = (el) => {
    el._html = el.innerHTML;
    const words = splitWords(el);
    let line = -1, lastTop = null, wi = 0;
    words.forEach(w => {
      const top = Math.round(w.getBoundingClientRect().top);
      if (lastTop === null || Math.abs(top - lastTop) > 4) { line++; wi = 0; lastTop = top; }
      w.style.setProperty('--li', line);
      w.style.setProperty('--wi', wi++);
    });
    el.classList.add('is-split');
    const base = parseFloat(getComputedStyle(el).getPropertyValue('--base')) || 0;
    el._dur = base + line * 110 + wi * 22 + 1300;
    return words;
  };
  /* after the words land, restore the original markup so the text renders exactly like the static build */
  const settle = (el) => {
    clearTimeout(el._settle);
    el._settle = setTimeout(() => { if (el._html != null && el.classList.contains('is-in')) el.innerHTML = el._html; }, el._dur);
  };

  /* ---------- img[data-media] → .media wrapper (clip reveal + inner parallax + hover zoom) ---------- */
  // data-media="frame" opens from a smaller rounded window instead of wiping up (variants.md §6b)
  $$('img[data-media]').forEach(img => {
    const w = document.createElement('div');
    w.className = 'media';
    w.dataset.reveal = img.dataset.media === 'frame' ? 'frame' : 'clip';
    if (img.dataset.cursor) { w.dataset.cursor = img.dataset.cursor; delete img.dataset.cursor; }
    w.style.width = img.getAttribute('width') + 'px';
    w.style.height = img.getAttribute('height') + 'px';
    img.before(w); w.appendChild(img);
  });

  /* ---------- [data-reveal]: rise (default) | clip | left | fade, auto-stagger per batch ---------- */
  // A fully clipped element has zero visible area for IntersectionObserver, so clip reveals watch their parent.
  const watch = new Map();
  const reveal = (el, i) => {
    const rd = Math.min(i, 6) * 90;
    el.style.setProperty('--rd', rd + 'ms');
    el.classList.add('is-in');
    // hand the element back to its normal (hover) transitions once it has landed
    setTimeout(() => { el.removeAttribute('data-reveal'); el.style.removeProperty('--rd'); }, rd + 1600);
  };
  const revObs = new IntersectionObserver(entries => {
    let i = 0;
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      revObs.unobserve(en.target);
      watch.get(en.target).forEach(el => reveal(el, i++));
    });
  }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
  $$('[data-reveal]').forEach(el => {
    const key = el.dataset.reveal === 'clip' ? el.parentElement : el;
    if (!watch.has(key)) watch.set(key, []);
    watch.get(key).push(el);
  });
  watch.forEach((_, key) => revObs.observe(key));

  /* ---------- [data-split] headings (after fonts so line breaks are final). "load" = runs on page load ---------- */
  const headObs = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      settle(en.target);
      headObs.unobserve(en.target);
    });
  }, { threshold: .3 });

  /* ---------- [data-count] counters: data-from, data-prefix, data-suffix, data-format="comma", data-decimals="1" ---------- */
  // data-decimals keeps short stats like "1.9M" or "8.2M" honest (Math.round would count 0 → 2 and land on 2)
  const fmt = (n, el) => {
    const dec = +(el.dataset.decimals || 0);
    const v = dec ? n.toFixed(dec) : Math.round(n);
    const out = el.dataset.format === 'comma' ? (+v).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v;
    return (el.dataset.prefix || '') + out + (el.dataset.suffix || '');
  };
  const countUp = (el) => {
    const end = +el.dataset.count, start = +(el.dataset.from || 0);
    if (reduce) return;
    const t0 = performance.now(), dur = 1800;
    const tick = t => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(start + (end - start) * e, el);
      if (p < 1) requestAnimationFrame(tick); else el.textContent = fmt(end, el);
    };
    el.textContent = fmt(start, el);
    requestAnimationFrame(tick);
  };
  const countObs = new IntersectionObserver(entries => {
    let i = 0;
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      countObs.unobserve(en.target);
      const el = en.target;
      setTimeout(() => countUp(el), i++ * 120);
    });
  }, { threshold: .5 });
  $$('[data-count]').forEach(el => countObs.observe(el));

  /* ---------- [data-scrub] paragraph: words fill in as you scroll ---------- */
  const scrubs = [];
  const scrub = (vh) => scrubs.forEach(({ el, words }) => {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) return;
    const p = clamp((vh * .85 - r.top) / (vh * .5)), n = words.length;
    words.forEach((w, i) => { w.style.opacity = (.16 + .84 * clamp(p * n * 1.1 - i)).toFixed(3); });
  });

  /* ---------- scroll loop ---------- */
  // [data-sticky-header] → .is-scrolled; ="hide" also adds .is-hidden while scrolling down (shows again on the way up)
  // [data-parallax="0.35"] → translate on Y; at rest when the parent sits where it loads (first screen) or is centered
  // [data-fade-out="-0.12"] → first-screen content drifts (factor) and fades while its parent scrolls away
  // .media > img → inner parallax via --py
  const sticky = $('[data-sticky-header]');
  const hideHeader = sticky && sticky.dataset.stickyHeader === 'hide';
  let lastY = scrollY;
  const parallax = $$('[data-parallax]').map(el => ({ el, f: parseFloat(el.dataset.parallax) || .3 }));
  const fades = $$('[data-fade-out]').map(el => ({ el, f: parseFloat(el.dataset.fadeOut) || 0 }));
  const medias = $$('.media');
  const measure = () => {
    const vh = innerHeight;
    parallax.forEach(p => {
      const box = p.el.parentElement.getBoundingClientRect(), top = box.top + scrollY;
      p.start = top < vh ? 0 : top + box.height / 2 - vh / 2;   // first screen: at rest at scrollY 0, even below an in-flow header
      p.top = top; p.h = box.height;
    });
    fades.forEach(p => { const box = p.el.parentElement.getBoundingClientRect(); p.top = box.top + scrollY; p.h = box.height; });
  };
  let ticking = false;
  const run = () => {
    const y = scrollY, vh = innerHeight;
    if (sticky) {
      sticky.classList.toggle('is-scrolled', y > 40);
      // hide after one screen of scrolling down, show on any scroll up; never while a menu inside it is open
      if (hideHeader && !sticky.querySelector('[aria-expanded="true"]')) {
        if (y > lastY + 2 && y > vh * .6) sticky.classList.add('is-hidden');
        else if (y < lastY - 2 || y <= vh * .6) sticky.classList.remove('is-hidden');
      }
      lastY = y;
    }
    if (!reduce) {
      parallax.forEach(p => {
        if (y + vh < p.top - 100 || y > p.top + p.h + 100) return;
        p.el.style.translate = `0 ${((y - p.start) * p.f).toFixed(1)}px`;
      });
      fades.forEach(p => {
        const d = y - p.top;
        if (d < -vh || d > p.h) return;
        p.el.style.translate = `0 ${(Math.max(0, d) * p.f).toFixed(1)}px`;
        p.el.style.opacity = clamp(1 - Math.max(0, d) / (p.h * .8)).toFixed(3);
      });
      medias.forEach(m => {
        const r = m.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        m.style.setProperty('--py', (((r.top + r.height / 2) - vh / 2) / vh * -34).toFixed(1) + 'px');
      });
      scrub(vh);
    }
    hooks.forEach(fn => fn(y, vh));
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
  addEventListener('resize', () => { measure(); run(); });
  measure(); run();

  /* fonts ready → split headings + scrub paragraphs (line breaks are final now) */
  const ready = document.fonts ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]) : Promise.resolve();
  ready.then(() => {
    $$('[data-split]').forEach(el => {
      splitHeading(el);
      if (el.dataset.split === 'load') { flush(el); el.classList.add('is-in'); settle(el); }
      else headObs.observe(el);
    });
    if (!reduce) $$('[data-scrub]').forEach(el => scrubs.push({ el, words: splitWords(el) }));
    measure(); run();
  });

  /* ---------- [data-roll] labels: letters roll up, a copy rises from below (hover or keyboard focus) ---------- */
  // The label is split only while active: split letters lose kerning (0.1-1.5px), so the plain text is put back at rest.
  // The trigger is the closest link/button (it gets .is-roll, so CSS can sync a fill with the roll).
  const esc = c => c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  if (!reduce) $$('[data-roll]').forEach(label => {
    if (label.children.length) return;   // plain-text labels only
    const trig = label.closest('a, button, [data-card-link]') || label.parentElement;
    const plain = label.innerHTML, text = label.textContent;
    const step = parseFloat(getComputedStyle(trig).getPropertyValue('--roll-step')) || 18;
    let n = 0, split = false, restoreT;
    const on = () => {
      clearTimeout(restoreT);
      if (!split) {
        split = true; n = 0;
        label.innerHTML = [...text].map(c => /\s/.test(c) ? c : `<span class="ch"><span class="ch__i" data-ch="${esc(c)}" style="--i:${n++}">${esc(c)}</span></span>`).join('');
        flush(label);   // commit the rest position so the roll transitions
      }
      trig.classList.add('is-roll');
    };
    const off = () => {
      trig.classList.remove('is-roll');
      clearTimeout(restoreT);
      restoreT = setTimeout(() => { if (!trig.classList.contains('is-roll')) { label.innerHTML = plain; split = false; } }, 560 + n * step);
    };
    trig.addEventListener('mouseenter', on);
    trig.addEventListener('mouseleave', off);
    trig.addEventListener('focus', () => { if (trig.matches(':focus-visible')) on(); });
    trig.addEventListener('blur', off);
  });

  /* ---------- [data-card-link]: whole block clicks through to its first link ---------- */
  $$('[data-card-link]').forEach(c => c.addEventListener('click', e => { if (!e.target.closest('a')) $('a', c)?.click(); }));

  // scrollTo(y): through Lenis when it runs, native smooth scroll otherwise (pinned-section step jumps use it)
  const scrollToY = y => window.Motion.lenis ? window.Motion.lenis.scrollTo(y) : scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  window.Motion = { $, $$, reduce, fine, clamp, flush, splitWords, splitHeading, settle, onScroll: fn => hooks.push(fn), scrollTo: scrollToY, lenis: null };

  if (reduce || !fine) return;

  /* ---------- [data-cursor="View"] label disc ---------- */
  let cur = $('.cursor');
  if (!cur) { cur = document.createElement('div'); cur.className = 'cursor'; cur.setAttribute('aria-hidden', 'true'); cur.innerHTML = '<span></span>'; document.body.appendChild(cur); }
  const curLabel = cur.firstElementChild;
  let cx = -200, cy = -200, tx = cx, ty = cy;
  addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; }, { passive: true });
  const follow = () => {
    // hidden: sit under the pointer so the disc grows in place instead of sliding in
    if (cur.classList.contains('is-on')) { cx += (tx - cx) * .18; cy += (ty - cy) * .18; } else { cx = tx; cy = ty; }
    // position with `translate`, NOT `transform`: `scale` is applied before `transform`,
    // so with transform the disc would grow out of the viewport's top-left corner
    cur.style.translate = `${cx.toFixed(1)}px ${cy.toFixed(1)}px`;
    requestAnimationFrame(follow);
  };
  requestAnimationFrame(follow);
  $$('[data-cursor]').forEach(t => {
    t.addEventListener('mouseenter', e => {
      tx = cx = e.clientX; ty = cy = e.clientY;
      cur.style.translate = `${cx}px ${cy}px`;
      curLabel.textContent = t.dataset.cursor;
      cur.classList.add('is-on');
    });
    t.addEventListener('mouseleave', () => cur.classList.remove('is-on', 'is-down'));
    t.addEventListener('pointerdown', () => cur.classList.add('is-down'));
    t.addEventListener('pointerup', () => cur.classList.remove('is-down'));
  });
  // over a link inside a cursor block, hide the disc so the real pointer takes over
  $$('[data-cursor] a').forEach(a => {
    a.addEventListener('mouseenter', () => cur.classList.remove('is-on'));
    a.addEventListener('mouseleave', () => cur.classList.add('is-on'));
  });

  /* ---------- Lenis smooth scroll (mouse/trackpad only). <html data-lenis="off"> disables it ---------- */
  if (root.dataset.lenis !== 'off') {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.min.js';
    s.onload = () => {
      const lenis = new Lenis({ lerp: .09, wheelMultiplier: .9, anchors: true });
      lenis.on('scroll', run); // parallax + scrub update in the same frame as the scroll
      window.Motion.lenis = lenis;
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    };
    document.head.appendChild(s);
  }
})();
