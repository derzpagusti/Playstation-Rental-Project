/*
 * Shared form validation (login, sign up, forgot password, my profile).
 * Requires js/shared/session.js.
 *
 *   NovaPS.checkField(input, form)   validate one field, show/hide its error
 *   NovaPS.initForm(form, onValid)   validate on submit, then call onValid(form)
 *
 * Inputs opt in with data-validate="required email phone password match different file"
 * (space separated, the first failing rule wins). Each input sits inside an
 * element with [data-field] that also holds a [data-error] element.
 */
(function () {
  var rules = {
    required: function (v) {
      return v.trim() ? "" : "This field is required.";
    },
    email: function (v) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
        ? ""
        : "Enter a valid email address.";
    },
    phone: function (v) {
      return /^(\+62|62|0)8\d{7,12}$/.test(v.replace(/[\s-]/g, ""))
        ? ""
        : "Enter a valid WhatsApp number (e.g. 0812-3456-7890).";
    },
    password: function (v) {
      return /^(?=.*\d).{8,}$/.test(v)
        ? ""
        : "Must have 8 characters & number.";
    },
    match: function (v, el, form) {
      return v === form.querySelector(el.dataset.match).value
        ? ""
        : "Passwords do not match.";
    },
    different: function (v, el, form) {
      return v !== form.querySelector(el.dataset.other).value
        ? ""
        : "New password must be different from your current password.";
    },
    file: function (v, el) {
      var f = el.files[0];
      if (!f) return "Please upload your ID card.";
      if (!/^image\//.test(f.type)) return "The file must be an image.";
      if (f.size > 5 * 1024 * 1024) return "The image must be 5 MB or smaller.";
      return "";
    },
  };

  // The [data-invalid] attribute drives the red border through Tailwind
  // (group-data-[invalid]/field:...)
  function checkField(el, form) {
    var names = el.dataset.validate.split(" ");
    var msg = "";
    for (var i = 0; i < names.length && !msg; i++) {
      msg = rules[names[i]](el.value, el, form);
    }
    var field = el.closest("[data-field]");
    field.toggleAttribute("data-invalid", !!msg);
    field.querySelector("[data-error]").textContent = msg;
    return !msg;
  }

  NovaPS.rules = rules;
  NovaPS.checkField = checkField;

  NovaPS.initForm = function (form, onValid) {
    var inputs = [].slice.call(form.querySelectorAll("[data-validate]"));

    inputs.forEach(function (el) {
      ["input", "change"].forEach(function (evt) {
        el.addEventListener(evt, function () {
          var field = el.closest("[data-field]");
          if (el.type === "file" || field.hasAttribute("data-invalid")) {
            checkField(el, form);
          }
        });
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      inputs.forEach(function (el) {
        if (!checkField(el, form)) ok = false;
      });
      if (!ok) {
        var bad = form.querySelector("[data-invalid] input");
        if (bad) bad.focus();
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Please wait…";
      onValid(form);
    });
  };
})();
