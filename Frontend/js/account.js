/*
 * My Profile page: edit ONE account field at a time + change password.
 * Requires js/shared/session.js, validation.js and image.js.
 *
 * Demo: data is read from / saved to localStorage through NovaPS.profile.
 * TODO: replace the saves below with real backend API calls.
 */
(function () {
  var LABELS = {
    fullname: "Full Name",
    phone: "Phone Number (WA)",
    email: "Email",
    address: "Address",
    idcard: "ID Card",
  };
  var TEXT_FIELDS = ["fullname", "phone", "email", "address"];

  // Password strength: tailwind classes are written in full so Tailwind finds them
  var BAR_BASE = "h-1 flex-1 rounded-full transition-colors duration-300";
  var BAR_COLORS = {
    weak: "bg-red-500",
    medium: "bg-amber-500",
    strong: "bg-green-500",
  };
  var BAR_EMPTY = "bg-slate-200";
  var LEVEL_TEXT = { weak: "Weak", medium: "Medium", strong: "Strong" };

  function $(id) {
    return document.getElementById(id);
  }

  var accountCard = $("account-card");
  var profileForm = $("profile-form");
  var banner = $("edit-banner");
  var accountActions = $("account-actions");
  var passwordView = $("password-view");
  var passwordForm = $("password-form");
  var changePasswordBtn = $("change-password");
  var upload = profileForm.querySelector("[data-upload]");
  var editButtons = [].slice.call(document.querySelectorAll("[data-edit]"));
  var toast = $("toast");

  var editing = null; // key of the field being edited, or null
  var toastTimer = null;

  function showToast(text) {
    toast.textContent = text;
    toast.setAttribute("data-open", "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.removeAttribute("data-open");
    }, 2800);
  }

  function clearError(form, el) {
    var field = el.closest("[data-field]");
    field.removeAttribute("data-invalid");
    field.querySelector("[data-error]").textContent = "";
  }

  /* ---------- Account data: one field at a time ---------- */

  function setIdPreview(src) {
    var img = upload.querySelector("img");
    if (src) img.src = src;
    else img.removeAttribute("src");
    upload.toggleAttribute("data-has-image", !!src);
  }

  function render() {
    var profile = NovaPS.profile.get();
    TEXT_FIELDS.forEach(function (key) {
      $(key).value = profile[key] || "";
    });
    $("idcard").value = "";
    setIdPreview(profile.idcard || "");
  }

  function setLocked(locked) {
    editButtons.forEach(function (btn) {
      btn.disabled = locked;
    });
    changePasswordBtn.disabled = locked;
  }

  function startEdit(key) {
    editing = key;
    var field = profileForm.querySelector('[data-field="' + key + '"]');
    var input = $(key);

    field.setAttribute("data-editing", "");
    if (key === "idcard") input.disabled = false;
    else input.readOnly = false;

    banner.textContent =
      "You are currently editing " +
      LABELS[key] +
      ", don’t forget to save your changes.";
    banner.hidden = false;
    accountActions.hidden = false;
    passwordView.hidden = true;
    setLocked(true);
    input.focus();
  }

  function stopEdit() {
    var key = editing;
    var field = profileForm.querySelector('[data-field="' + key + '"]');
    var input = $(key);

    field.removeAttribute("data-editing");
    clearError(profileForm, input);
    if (key === "idcard") input.disabled = true;
    else input.readOnly = true;

    banner.hidden = true;
    accountActions.hidden = true;
    passwordView.hidden = false;
    setLocked(false);
    editing = null;
  }

  editButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      startEdit(btn.dataset.edit);
    });
  });

  $("cancel-field").addEventListener("click", function () {
    stopEdit();
    render(); // put the saved value back
  });

  // Clear a field's error while the user fixes it
  TEXT_FIELDS.forEach(function (key) {
    $(key).addEventListener("input", function () {
      var field = this.closest("[data-field]");
      if (field.hasAttribute("data-invalid")) {
        NovaPS.checkField(this, profileForm);
      }
    });
  });

  // ID card: preview the chosen picture right away
  $("idcard").addEventListener("change", function () {
    var file = this.files[0];
    if (file && /^image\//.test(file.type)) {
      setIdPreview(URL.createObjectURL(file));
    }
    NovaPS.checkField(this, profileForm);
  });

  function commit(key, patch) {
    // Keep the order history of an account whose email changes
    if (key === "email") {
      NovaPS.orders.renameOwner(NovaPS.profile.get().email, patch.email);
    }
    NovaPS.profile.set(patch);
    stopEdit();
    render();
    showToast(LABELS[key] + " updated");
  }

  profileForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!editing) return;

    var key = editing;
    var input = $(key);
    if (!NovaPS.checkField(input, profileForm)) return;

    if (key === "idcard") {
      NovaPS.imageToDataUrl(input.files[0], 900).then(
        function (dataUrl) {
          commit(key, { idcard: dataUrl });
        },
        function () {
          var field = input.closest("[data-field]");
          field.setAttribute("data-invalid", "");
          field.querySelector("[data-error]").textContent =
            "Could not read this image. Try another one.";
        },
      );
      return;
    }

    var value = input.value.trim();
    if (value === (NovaPS.profile.get()[key] || "")) {
      stopEdit();
      render();
      showToast("No changes made");
      return;
    }
    // TODO: send { [key]: value } to the backend API.
    var patch = {};
    patch[key] = value;
    commit(key, patch);
  });

  /* ---------- Change password ---------- */

  var passwordInputs = [].slice.call(
    passwordForm.querySelectorAll("[data-validate]"),
  );
  var newPassword = $("new-password");
  var confirmPassword = $("confirm-password");
  var bars = [].slice.call(passwordForm.querySelectorAll("[data-bar]"));
  var strengthLabel = $("strength-label");
  var currentField = $("current-field");
  var resetEmailField = $("reset-email-field");
  var passwordBanner = $("password-banner");
  var PASSWORD_BANNER =
    "You are currently editing password, don’t forget to save your changes.";
  var RESET_BANNER =
    "Forgot your password? Set a new one below, don’t forget to save your changes.";
  var resetMode = false; // true = "forgot password" inside My Profile
  var requirements = {
    length: passwordForm.querySelector('[data-req="length"]'),
    number: passwordForm.querySelector('[data-req="number"]'),
  };

  function score(v) {
    var s = 0;
    if (v.length >= 8) s++;
    if (v.length >= 12) s++;
    if (/\d/.test(v)) s++;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    return s;
  }

  function updateStrength() {
    var v = newPassword.value;
    var s = score(v);
    var level = s >= 4 ? "strong" : s === 3 ? "medium" : "weak";
    var on = v ? Math.min(4, Math.max(1, s)) : 0;

    bars.forEach(function (bar, i) {
      bar.className = BAR_BASE + " " + (i < on ? BAR_COLORS[level] : BAR_EMPTY);
    });
    strengthLabel.textContent = v
      ? "Password strength: " + LEVEL_TEXT[level]
      : "";
    requirements.length.toggleAttribute("data-ok", v.length >= 8);
    requirements.number.toggleAttribute("data-ok", /\d/.test(v));
  }

  // "Forgot your current password?" without leaving My Profile:
  // the current password field is replaced by the (read-only) account email.
  // TODO: with a backend, verify the user (e.g. a code sent to this email)
  // before saving the new password.
  function setResetMode(on, focus) {
    resetMode = on;
    currentField.hidden = on;
    resetEmailField.hidden = !on;
    passwordBanner.textContent = on ? RESET_BANNER : PASSWORD_BANNER;
    if (on) {
      $("reset-email").value = NovaPS.profile.get().email || "";
      $("current-password").value = "";
      clearError(passwordForm, $("current-password"));
    }
    if (focus) (on ? newPassword : $("current-password")).focus();
  }

  $("forgot-toggle").addEventListener("click", function () {
    setResetMode(true, true);
  });
  $("remember-toggle").addEventListener("click", function () {
    setResetMode(false, true);
  });

  function resetPasswordForm() {
    passwordForm.reset();
    setResetMode(false, false);
    passwordInputs.forEach(function (el) {
      clearError(passwordForm, el);
      el.type = "password";
      el.parentElement.removeAttribute("data-visible");
    });
    updateStrength();
  }

  function setPasswordMode(on) {
    accountCard.hidden = on;
    accountActions.hidden = true;
    passwordView.hidden = on;
    passwordForm.hidden = !on;
    if (on) $("current-password").focus();
    else resetPasswordForm();
  }

  changePasswordBtn.addEventListener("click", function () {
    setPasswordMode(true);
  });
  $("cancel-password").addEventListener("click", function () {
    setPasswordMode(false);
  });

  // Show / hide password (eye button)
  [].slice
    .call(passwordForm.querySelectorAll("[data-toggle-password]"))
    .forEach(function (btn) {
      btn.addEventListener("click", function () {
        var wrapper = btn.parentElement;
        var input = wrapper.querySelector("input");
        var show = input.type === "password";
        input.type = show ? "text" : "password";
        wrapper.toggleAttribute("data-visible", show);
        btn.setAttribute("aria-pressed", String(show));
        btn.setAttribute(
          "aria-label",
          show ? "Hide password" : "Show password",
        );
      });
    });

  newPassword.addEventListener("input", function () {
    updateStrength();
    if (confirmPassword.value) NovaPS.checkField(confirmPassword, passwordForm);
  });

  passwordForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var ok = true;
    // The hidden current password field is skipped in "forgot password" mode
    passwordInputs
      .filter(function (el) {
        return !el.closest("[hidden]");
      })
      .forEach(function (el) {
        if (!NovaPS.checkField(el, passwordForm)) ok = false;
      });
    if (!ok) {
      var bad = passwordForm.querySelector("[data-invalid] input");
      if (bad) bad.focus();
      return;
    }

    // TODO: send the new password to the backend API. The server must verify
    // the current password (or the reset verification); this demo cannot.
    var message = resetMode ? "Password reset" : "Password updated";
    setPasswordMode(false);
    showToast(message);
  });

  render();
})();
