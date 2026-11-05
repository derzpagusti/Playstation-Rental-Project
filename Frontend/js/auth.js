/* NovaPS - validation for login, sign up and forgot password forms.
   DEMO ONLY: no server yet. On success the user is marked as logged in and
   sent to the home page. Replace the TODO with a real API call later. */
(function () {
  var form = document.querySelector('form[data-form]');
  if (!form) return;

  var rules = {
    required: function (v) { return v.trim() ? '' : 'This field is required.'; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter a valid email address.'; },
    phone: function (v) { return /^(\+62|62|0)8\d{7,12}$/.test(v.replace(/[\s-]/g, '')) ? '' : 'Enter a valid WhatsApp number (e.g. 0812-3456-7890).'; },
    password: function (v) { return /^(?=.*\d).{8,}$/.test(v) ? '' : 'Must have 8 characters & number.'; },
    match: function (v, el) { return v === form.querySelector(el.dataset.match).value ? '' : 'Passwords do not match.'; },
    file: function (v, el) {
      var f = el.files[0];
      if (!f) return 'Please upload your ID card.';
      if (!/^image\//.test(f.type)) return 'The file must be an image.';
      if (f.size > 5 * 1024 * 1024) return 'The image must be 5 MB or smaller.';
      return '';
    }
  };

  // The [data-invalid] attribute drives the red border via Tailwind (group-data-[invalid]/field:...)
  function check(el) {
    var msg = rules[el.dataset.validate](el.value, el);
    var field = el.closest('[data-field]');
    field.toggleAttribute('data-invalid', !!msg);
    field.querySelector('[data-error]').textContent = msg;
    return !msg;
  }

  var inputs = [].slice.call(form.querySelectorAll('[data-validate]'));
  inputs.forEach(function (el) {
    ['input', 'change'].forEach(function (evt) {
      el.addEventListener(evt, function () {
        if (el.type === 'file' || el.closest('[data-field]').hasAttribute('data-invalid')) check(el);
      });
    });
  });

  // ID card preview
  var upload = form.querySelector('[data-upload]');
  if (upload) {
    var fileInput = upload.querySelector('input');
    fileInput.addEventListener('change', function () {
      var f = fileInput.files[0];
      var ok = !!f && /^image\//.test(f.type);
      if (ok) upload.querySelector('img').src = URL.createObjectURL(f);
      upload.toggleAttribute('data-has-image', ok);
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = true;
    inputs.forEach(function (el) { if (!check(el)) ok = false; });
    if (!ok) {
      var bad = form.querySelector('[data-invalid] input');
      if (bad) bad.focus();
      return;
    }

    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Please wait…';

    // TODO: send the form data to the backend API here.
    var email = form.querySelector('[type="email"]').value.trim();
    setTimeout(function () {
      NovaPS.login(email);
      location.href = '../index.html';
    }, 600);
  });
})();
