'use strict';

// Image assets are copied byte-for-byte from characters.zip.  CSS only scales
// the displayed image and never stretches or crops its intrinsic aspect ratio.
const PORTRAIT_PATHS = Object.freeze({
  yuzuha: 'assets/portraits/yuzuha.jpg',
  caesar: 'assets/portraits/caesar.jpg',
  araya: 'assets/portraits/araya.jpg',
  lapis: 'assets/portraits/lapis.png',
  tori: 'assets/portraits/tori.jpg',
  akira: 'assets/portraits/akira.jpg',
  sonic: 'assets/portraits/sonic.jpg',
  david: 'assets/portraits/david.jpg',
  chieko: 'assets/portraits/chieko.jpg',
  airi: 'assets/portraits/airi.jpg',
  dio: 'assets/portraits/dio.jpg',
  kayano: 'assets/portraits/kayano.jpg',
  mechamaru: 'assets/portraits/mechamaru.jpg',
  kisei: 'assets/portraits/kisei.jpg'
});

// The original UI invokes portrait() in both the selection cards and hero info.
portrait = function(c) {
  return `<div class="fighter-portrait" style="--portrait-accent:${c.color}">
    <img class="portrait-original" src="${PORTRAIT_PATHS[c.id]}"
      alt="Портрет: ${esc(c.name)}" loading="lazy" decoding="async">
  </div>`;
};

const homeWithoutPortraits = App.home.bind(App);
App.home = function() {
  homeWithoutPortraits();
  const hero = document.querySelector('.home-grid .hero');
  const footer = document.querySelector('#app > .footer');
  if (!hero || !footer) return;

  hero.classList.add('hero-with-portrait');
  const featured = document.createElement('img');
  featured.className = 'hero-featured-portrait';
  featured.src = PORTRAIT_PATHS[this.config.p1];
  featured.alt = 'Избранный персонаж';
  featured.decoding = 'async';
  featured.fetchPriority = 'high';
  hero.prepend(featured);

  const selector = document.createElement('section');
  selector.className = 'home-portrait-selector';
  selector.setAttribute('aria-label', 'Галерея персонажей');
  selector.innerHTML = `<div class="home-portrait-heading">
    <div><span class="eyebrow">ВСЕ БОЙЦЫ</span><h3>Выбери будущего чемпиона</h3></div>
    <small>14 оригинальных портретов · без потери качества</small>
  </div><div class="home-portrait-strip">${CHARS.map(c => `
    <button type="button" class="home-portrait-button ${c.id === App.config.p1 ? 'selected' : ''}"
      data-featured-character="${c.id}" title="${esc(c.name)}">
      <img src="${PORTRAIT_PATHS[c.id]}" alt="" loading="lazy" decoding="async">
      <span>${esc(c.short)}</span>
    </button>`).join('')}</div>`;
  footer.before(selector);

  selector.querySelectorAll('[data-featured-character]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.featuredCharacter;
      const fighter = char(id);
      App.config.p1 = id;
      featured.src = PORTRAIT_PATHS[id];
      featured.alt = `Портрет: ${fighter.name}`;
      const label = hero.querySelector('.hero-bottom span');
      const description = hero.querySelector('.hero-bottom p');
      if (label) label.textContent = fighter.name.toUpperCase();
      if (description) description.textContent = fighter.tag;
      selector.querySelectorAll('[data-featured-character]')
        .forEach(item => item.classList.toggle('selected', item === button));
    });
  });

  const current = char(App.config.p1);
  const label = hero.querySelector('.hero-bottom span');
  const description = hero.querySelector('.hero-bottom p');
  if (label) label.textContent = current.name.toUpperCase();
  if (description) description.textContent = current.tag;
};
