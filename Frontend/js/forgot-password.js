/* Forgot password page. Requires js/shared/session.js and js/shared/validation.js. */
(function () {
  NovaPS.initForm(
    document.getElementById("forgot-password-form"),
    function (form) {
      var email = form.querySelector('[type="email"]').value.trim();

      // TODO: call the backend "reset password" API here.
      setTimeout(function () {
        NovaPS.login(email);
        location.href = "../index.html";
      }, 600);
    },
  );
})();
