/*
 * Shared by pages with the logged-in navbar: profile menu + logout.
 * Requires js/shared/session.js.
 *
 * <body data-logout-redirect="../index.html"> sends the user to that page after
 * logout (used on protected pages). Without it the navbar just switches to the
 * guest version.
 */
(function () {
  var profileBtn = document.getElementById("profileBtn");
  if (!profileBtn) return;
  var profile = profileBtn.parentElement;

  function setOpen(open) {
    profile.toggleAttribute("data-open", open); // Tailwind: group-data-[open]:...
    profileBtn.setAttribute("aria-expanded", String(open));
  }

  profileBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    setOpen(!profile.hasAttribute("data-open"));
  });
  document.addEventListener("click", function () {
    setOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setOpen(false);
  });

  document.getElementById("logoutBtn").addEventListener("click", function () {
    NovaPS.logout();
    var redirect = document.body.dataset.logoutRedirect;
    if (redirect) {
      location.href = redirect;
      return;
    }
    document.documentElement.classList.remove("logged-in");
    setOpen(false);
  });
})();
