/* NAFC Home v6: project interactions on top of motion-core.js (loads after it, both defer).
   Runs only with motion on (html.js); ?static and the XD diff keep the plain build. */
(() => {
  if (!window.Motion) return;
  const { $, $$, fine, flush, onScroll } = Motion;

  /* ---------- hero: the finder's redrawn backdrop follows the hero photo (zoom + parallax) ---------- */
  const heroMedia = $('.hero__media'), backdrop = $('.finder__backdrop');
  if (heroMedia && backdrop) onScroll(() => { backdrop.style.translate = heroMedia.style.translate; });

  /* ---------- header nav: one pill slides to the hovered link (desktop bar only) ---------- */
  const navList = $('.main-nav ul');
  if (navList && fine) {
    const desk = matchMedia('(min-width: 1280px)');
    const pill = document.createElement('li');
    pill.className = 'nav-pill'; pill.setAttribute('aria-hidden', 'true');
    navList.appendChild(pill);   // absolute, so the flex row and its gaps don't change
    const links = $$('li:not(.nav-pill)', navList);
    // 14px either side, 9px above and below: 37px tall, the height of the header buttons
    const place = (li) => {
      const r = li.getBoundingClientRect(), u = navList.getBoundingClientRect();
      pill.style.translate = `${(r.left - u.left - 14).toFixed(2)}px ${(r.top - u.top - 9).toFixed(2)}px`;
      pill.style.width = r.width + 28 + 'px';
      pill.style.height = r.height + 18 + 'px';
    };
    links.forEach(li => li.addEventListener('mouseenter', () => {
      if (!desk.matches) return;
      if (!pill.classList.contains('is-on')) {   // first link: appear in place, don't slide in from the corner
        pill.style.transition = 'none'; place(li); flush(pill); pill.style.transition = '';
        pill.classList.add('is-on');
      } else place(li);
    }));
    navList.addEventListener('mouseleave', () => pill.classList.remove('is-on'));
  }

  /* ---------- start: rows pick the photo and the card copy (hover intent, click, Enter) ---------- */
  const items = $$('.paths__item');
  const photo = $('.start__photo'), card = $('.start__card');
  if (items.length && photo && card) {
    const h3 = $('h3', card), p = $('p', card), first = $('img', photo);
    const data = items.map(li => li.dataset.img
      ? { img: li.dataset.img, alt: li.dataset.alt, title: li.dataset.title, text: li.dataset.text }
      : { img: first.getAttribute('src'), alt: first.alt, title: h3.textContent, text: p.textContent });
    let active = 0, swapT, preloaded = false;

    const preload = () => { if (preloaded) return; preloaded = true; data.forEach(d => { new Image().src = d.img; }); };
    const set = (i) => {
      if (i === active) return;
      items[active].classList.remove('paths__item--active');
      $('a', items[active]).removeAttribute('aria-current');
      items[i].classList.add('paths__item--active');
      $('a', items[i]).setAttribute('aria-current', 'true');
      active = i;

      // photo: the new one wipes up over the old one, then the covered ones are removed
      const d = data[i], img = document.createElement('img');
      img.className = 'start__next'; img.src = d.img; img.alt = d.alt;
      photo.appendChild(img);
      const show = () => { flush(img); img.classList.add('is-in'); };
      img.decode ? img.decode().then(show, show) : show();
      clearTimeout(photo._clean);
      photo._clean = setTimeout(() => {
        const all = $$('img', photo), top = all[all.length - 1];
        all.forEach(el => { if (el !== top) el.remove(); });
      }, 1300);

      // copy: drop out, swap, rise back
      card.classList.add('is-swap');
      clearTimeout(swapT);
      swapT = setTimeout(() => { h3.textContent = d.title; p.textContent = d.text; card.classList.remove('is-swap'); }, 280);
    };

    items.forEach((li, i) => {
      const a = $('a', li);
      let intent;
      a.addEventListener('click', e => { e.preventDefault(); set(i); });
      if (fine) {
        li.addEventListener('mouseenter', () => { preload(); intent = setTimeout(() => set(i), 180); });
        li.addEventListener('mouseleave', () => clearTimeout(intent));
      }
      a.addEventListener('focus', preload);
    });
  }

  /* ---------- impact cards: the arrow follows the hovered link, back to the first on leave ---------- */
  $$('.program__links').forEach(list => {
    const lis = $$('li', list), arrow = $('.i-arrow-ur', list);
    if (!arrow) return;
    lis.forEach(li => { if (!li.contains(arrow)) li.appendChild(arrow.cloneNode(true)); });
    const on = li => lis.forEach(el => el.classList.toggle('is-arrow', el === li));
    on(lis[0]);
    lis.forEach(li => li.addEventListener('mouseenter', () => on(li)));
    list.addEventListener('mouseleave', () => on(lis[0]));
  });

  /* swipe row (≤1023): cards off to the side never enter the viewport, so reveal all three when the row arrives */
  const programs = $('.programs');
  if (programs && matchMedia('(max-width: 1023.98px)').matches) {
    new IntersectionObserver((entries, obs) => {
      if (!entries[0].isIntersecting) return;
      obs.disconnect();
      $$('.program[data-reveal]', programs).forEach((card, i) => {
        card.style.setProperty('--rd', i * 90 + 'ms');
        card.classList.add('is-in');
        setTimeout(() => { card.removeAttribute('data-reveal'); card.style.removeProperty('--rd'); }, i * 90 + 1600);
      });
    }, { threshold: .12 }).observe(programs);
  }

  /* ---------- partners: endless marquee, two identical sets ---------- */
  const logos = $('.logos');
  if (logos) {
    const marquee = document.createElement('div'), track = document.createElement('div');
    marquee.className = 'marquee'; track.className = 'marquee__track';
    logos.before(marquee); marquee.appendChild(track); track.appendChild(logos);
    const copy = logos.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    $$('img', copy).forEach(img => { img.alt = ''; });
    track.appendChild(copy);
  }

  /* ---------- symposium countdown: live, to Sept 26, 2027 at midnight in Phoenix (UTC-7, no DST) ---------- */
  const target = Date.UTC(2027, 8, 26, 7, 0, 0);
  const cd = { days: $('[data-cd="days"]'), hours: $('[data-cd="hours"]'), minutes: $('[data-cd="minutes"]') };
  if (cd.days) {
    const pad = n => String(n).padStart(2, '0');
    const tick = () => {
      const ms = Math.max(0, target - Date.now());
      cd.days.textContent = Math.floor(ms / 864e5);
      cd.hours.textContent = pad(Math.floor(ms % 864e5 / 36e5));
      cd.minutes.textContent = pad(Math.floor(ms % 36e5 / 6e4));
    };
    tick();
    setInterval(tick, 20000);
  }
})();
