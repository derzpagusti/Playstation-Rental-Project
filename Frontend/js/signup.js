/*
 * Sign up page.
 * Requires js/shared/session.js, validation.js and image.js.
 */
(function () {
  var form = document.getElementById("signup-form");

  // ID card preview
  var upload = form.querySelector("[data-upload]");
  var fileInput = upload.querySelector("input");
  fileInput.addEventListener("change", function () {
    var file = fileInput.files[0];
    var isImage = !!file && /^image\//.test(file.type);
    if (isImage) upload.querySelector("img").src = URL.createObjectURL(file);
    upload.toggleAttribute("data-has-image", isImage);
  });

  NovaPS.initForm(form, function () {
    var profile = {
      fullname: form.elements.fullname.value.trim(),
      phone: form.elements.phone.value.trim(),
      address: form.elements.address.value.trim(),
      email: form.elements.email.value.trim(),
    };

    // TODO: send the sign up data (including the ID card image) to the backend API.
    // Demo: keep the data in this browser so "My Profile" can show it.
    NovaPS.imageToDataUrl(fileInput.files[0], 900)
      .then(function (dataUrl) {
        profile.idcard = dataUrl;
      })
      .catch(function () {})
      .then(function () {
        NovaPS.login(profile.email, profile);
        location.href = "../index.html";
      });
  });
})();
