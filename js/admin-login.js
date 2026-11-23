/*
 * Admin login page.
 * Requires js/shared/session.js, admin.js and validation.js.
 * DEMO ONLY: see the note in js/shared/admin.js.
 */
(function () {
  if (NovaPS.admin.isLoggedIn()) {
    location.replace("dashboard.html");
    return;
  }

  var form = document.getElementById("admin-login-form");
  var button = form.querySelector('button[type="submit"]');
  var label = button.textContent;

  NovaPS.initForm(form, function () {
    var email = form.elements.email.value;
    var password = form.elements.password.value;

    // TODO: check the admin login on the server instead.
    if (NovaPS.admin.login(email, password)) {
      location.href = "dashboard.html";
      return;
    }

    var field = form.elements.password.closest("[data-field]");
    field.setAttribute("data-invalid", "");
    field.querySelector("[data-error]").textContent =
      "Wrong email or password.";
    button.disabled = false;
    button.textContent = label;
  });
})();
