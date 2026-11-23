/* Login page. Requires js/shared/session.js and js/shared/validation.js. */
(function () {
  var form = document.getElementById("login-form");
  var button = form.querySelector('button[type="submit"]');
  button.dataset.label = button.textContent;

  // Blocked by the admin: show the reason on the email field
  function showBlocked(form) {
    var email = form.querySelector('[type="email"]');
    var field = email.closest("[data-field]");
    field.setAttribute("data-invalid", "");
    field.querySelector("[data-error]").textContent =
      "This account has been blocked. Please contact the admin.";
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = false;
    btn.textContent = btn.dataset.label;
  }

  // Sent here because a logged-in user was blocked by the admin
  if (new URLSearchParams(location.search).get("blocked")) showBlocked(form);

  NovaPS.initForm(form, function () {
    var email = form.querySelector('[type="email"]').value.trim();

    if (NovaPS.users.isBlocked(email)) {
      showBlocked(form);
      return;
    }

    // TODO: call the backend login API here instead of this demo.
    setTimeout(function () {
      NovaPS.login(email);
      location.href = "../index.html";
    }, 600);
  });
})();
