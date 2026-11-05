/* Login page. Requires js/shared/session.js and js/shared/validation.js. */
(function () {
  NovaPS.initForm(document.getElementById("login-form"), function (form) {
    var email = form.querySelector('[type="email"]').value.trim();

    // TODO: call the backend login API here instead of this demo.
    setTimeout(function () {
      NovaPS.login(email);
      location.href = "../index.html";
    }, 600);
  });
})();
