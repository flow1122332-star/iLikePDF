/* ============================================================
   iLikePDF — Main JavaScript
   Mobile menu, tools dropdown, footer year
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Mobile menu toggle ---------- */
  var menuBtn = document.getElementById('menuBtn');
  var mobileNav = document.getElementById('mobileNav');

  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', function () {
      var isOpen = menuBtn.getAttribute('aria-expanded') === 'true';
      var newState = !isOpen;

      menuBtn.setAttribute('aria-expanded', String(newState));
      menuBtn.setAttribute('aria-label', newState ? 'Close menu' : 'Open menu');
      mobileNav.classList.toggle('is-open', newState);
    });

    // Close menu when clicking any link inside
    mobileNav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        menuBtn.setAttribute('aria-expanded', 'false');
        mobileNav.classList.remove('is-open');
      }
    });

    // Auto-close menu on resize to desktop
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 960) {
        menuBtn.setAttribute('aria-expanded', 'false');
        mobileNav.classList.remove('is-open');
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        menuBtn.setAttribute('aria-expanded', 'false');
        mobileNav.classList.remove('is-open');
      }
    });
  }

  /* ---------- Tools dropdown (desktop) ---------- */
  var dropTrigger = document.querySelector('.nav-drop-trigger');
  var dropMenu = document.querySelector('.nav-drop');

  if (dropTrigger && dropMenu) {
    dropTrigger.addEventListener('click', function (e) {
      e.preventDefault();
      var isOpen = dropTrigger.getAttribute('aria-expanded') === 'true';
      var newState = !isOpen;

      dropTrigger.setAttribute('aria-expanded', String(newState));
      dropMenu.classList.toggle('is-open', newState);
    });

    // Close when clicking outside
    document.addEventListener('click', function (e) {
      if (!dropTrigger.parentElement.contains(e.target)) {
        dropTrigger.setAttribute('aria-expanded', 'false');
        dropMenu.classList.remove('is-open');
      }
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        dropTrigger.setAttribute('aria-expanded', 'false');
        dropMenu.classList.remove('is-open');
      }
    });
  }

  /* ---------- Footer year (auto-update) ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

})();
