/* NovaPS - shared: login state, navbar, "login required" pop-up.
   DEMO ONLY: the login state is kept in localStorage. Replace with a real
   backend/API session later. */
(function () {
  var KEY = 'novaps_user';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }

  window.NovaPS = {
    isLoggedIn: function () { return !!read(); },
    login: function (email) { try { localStorage.setItem(KEY, JSON.stringify({ email: email })); } catch (e) {} },
    logout: function () { try { localStorage.removeItem(KEY); } catch (e) {} }
  };

  // Runs immediately (script is in <head>) so the navbar never flashes the wrong state.
  // Tailwind's custom "logged-in:" variant reacts to this class.
  if (NovaPS.isLoggedIn()) document.documentElement.classList.add('logged-in');

  document.addEventListener('DOMContentLoaded', function () {
    var modal = document.getElementById('loginModal');
    var lastFocus = null;

    function setModal(open) {
      modal.toggleAttribute('data-open', open);               // Tailwind: data-[open]:...
      modal.setAttribute('aria-hidden', String(!open));
      document.body.classList.toggle('overflow-hidden', open);
    }

    function openModal() {
      lastFocus = document.activeElement;
      setModal(true);
      setTimeout(function () { modal.querySelector('a').focus(); }, 50);
    }

    function closeModal() {
      if (!modal || !modal.hasAttribute('data-open')) return;
      setModal(false);
      if (lastFocus) lastFocus.focus();
    }

    // Every Order / Choose & Rent button
    document.querySelectorAll('[data-order]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        if (!NovaPS.isLoggedIn()) { openModal(); return; }
        // Logged in: the order form page will be connected here.
      });
    });

    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal || e.target.hasAttribute('data-close')) closeModal();
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    }

    // Profile dropdown (logout)
    var pBtn = document.getElementById('profileBtn');
    if (pBtn) {
      var profile = pBtn.parentElement;
      var setOpen = function (open) {
        profile.toggleAttribute('data-open', open);
        pBtn.setAttribute('aria-expanded', String(open));
      };
      pBtn.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!profile.hasAttribute('data-open')); });
      document.addEventListener('click', function () { setOpen(false); });
      document.getElementById('logoutBtn').addEventListener('click', function () {
        NovaPS.logout();
        document.documentElement.classList.remove('logged-in');
      });
    }
  });
})();
