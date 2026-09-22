/* ============================================================
   iLikePDF — Main script
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Header shadow on scroll ---------- */
  var header = document.getElementById('siteHeader');
  var onScroll = function () {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  var menuBtn = document.getElementById('menuBtn');
  var mobileNav = document.getElementById('mobileNav');

  function setMenu(open) {
    if (!menuBtn || !mobileNav) return;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mobileNav.classList.toggle('is-open', open);
  }

  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', function () {
      setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
    });

    mobileNav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth >= 900) setMenu(false);
    });
  }

  /* ---------- Tool search / filter ---------- */
  var input = document.getElementById('toolSearch');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.tool-card'));
  var empty = document.getElementById('toolsEmpty');

  if (input && cards.length) {
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      var tokens = q ? q.split(/\s+/) : [];
      var visible = 0;

      cards.forEach(function (card) {
        var haystack = ((card.dataset.name || '') + ' ' + (card.dataset.tags || '')).toLowerCase();
        var match = tokens.length === 0 || tokens.every(function (t) {
          return haystack.indexOf(t) !== -1;
        });
        card.classList.toggle('is-hidden', !match);
        if (match) visible++;
      });

      if (empty) empty.hidden = visible > 0;
    });
  }

  /* ---------- Scroll reveal ---------- */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          var delay = Number(el.dataset.delay || 0);
          setTimeout(function () { el.classList.add('is-in'); }, delay);
          observer.unobserve(el);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealEls.forEach(function (el, i) {
      if (el.classList.contains('tool-card')) {
        el.dataset.delay = String((i % 3) * 70);
      }
      observer.observe(el);
    });
  }

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

})();
