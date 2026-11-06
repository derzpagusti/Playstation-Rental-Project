/*
 * Shared by every admin page: admin session, page guard and the "Admin" menu.
 * Requires js/shared/session.js.
 *
 * DEMO ONLY - the admin email and password below are visible to anyone who
 * opens this file. A real admin login must be checked on the server.
 *
 * Protect a page by adding data-require-admin="<login url>" to this script tag.
 */
(function () {
  var KEY = "novaps_admin";
  var ADMIN = { email: "admin@novaps.com", password: "Admin#123" };

  NovaPS.admin = {
    isLoggedIn: function () {
      try {
        return !!JSON.parse(localStorage.getItem(KEY));
      } catch (e) {
        return false;
      }
    },
    login: function (email, password) {
      if (
        email.trim().toLowerCase() !== ADMIN.email ||
        password !== ADMIN.password
      ) {
        return false;
      }
      try {
        localStorage.setItem(KEY, JSON.stringify({ email: ADMIN.email }));
      } catch (e) {}
      return true;
    },
    logout: function () {
      try {
        localStorage.removeItem(KEY);
      } catch (e) {}
    },
  };

  // Guests are sent to the admin login before anything renders
  var loginUrl =
    document.currentScript && document.currentScript.dataset.requireAdmin;
  if (loginUrl && !NovaPS.admin.isLoggedIn()) location.replace(loginUrl);

  document.addEventListener("DOMContentLoaded", function () {
    var button = document.getElementById("adminBtn");
    if (!button) return;
    var wrapper = button.parentElement;

    function setOpen(open) {
      wrapper.toggleAttribute("data-open", open); // Tailwind: group-data-[open]:...
      button.setAttribute("aria-expanded", String(open));
    }

    button.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(!wrapper.hasAttribute("data-open"));
    });
    document.addEventListener("click", function () {
      setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
    document
      .getElementById("adminLogout")
      .addEventListener("click", function () {
        NovaPS.admin.logout();
        location.href = "login.html";
      });
  });
})();
