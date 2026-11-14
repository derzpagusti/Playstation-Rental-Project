
/*
 * NovaPS - Customer Login
 * Backend: PHP Session
 */
(function () {
  const API_BASE = "/playstation/backend/public/api";

  const form = document.getElementById("login-form");

  if (!form) {
    console.error("Form login tidak ditemukan.");
    return;
  }

  const button = form.querySelector('button[type="submit"]');

  // Mendukung HTML lama yang masih memakai id="email".
  const phoneInput = form.querySelector(
      '#phone, #email, [name="phone"], [name="email"]'
  );

  const passwordInput = form.querySelector(
      '#password, [name="password"]'
  );

  if (!phoneInput || !passwordInput || !button) {
    console.error("Elemen login tidak lengkap.", {
      phoneInput,
      passwordInput,
      button
    });
    return;
  }

  // Sesuaikan input lama agar menerima nomor HP.
  phoneInput.type = "tel";
  phoneInput.id = "phone";
  phoneInput.name = "phone";
  phoneInput.placeholder = "081234567890";
  phoneInput.dataset.validate = "phone";

  const phoneLabel = form.querySelector(
      'label[for="email"], label[for="phone"]'
  );

  if (phoneLabel) {
    phoneLabel.htmlFor = "phone";
    phoneLabel.textContent = "Phone Number";
  }

  function showError(message) {
    const field = phoneInput.closest("[data-field]");

    if (field) {
      field.setAttribute("data-invalid", "");

      const errorElement = field.querySelector("[data-error]");

      if (errorElement) {
        errorElement.textContent = message;
      }
    }

    console.error("Login error:", message);
  }

  // Menangani submit sendiri tanpa NovaPS.initForm,
  // agar tidak bentrok dengan validasi demo lama.
  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const phone = phoneInput.value.trim();
    const password = passwordInput.value;

    if (!phone || !password) {
      showError("Nomor HP dan password wajib diisi.");
      return;
    }

    button.disabled = true;
    button.textContent = "Please wait…";

    try {
      console.log("Mengirim request login...");

      const response = await fetch(
          `${API_BASE}/auth/login.php`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              phone,
              password
            })
          }
      );

      const result = await response.json();

      console.log("Login response:", {
        status: response.status,
        success: result.success
      });

      if (!response.ok || result.success !== true) {
        throw new Error(
            result.message || "Login gagal."
        );
      }

      const user = result.data;

      // Penanda UI sementara untuk frontend demo.
      const localEmail =
          `customer-${user.user_id}@local.test`;

      NovaPS.login(localEmail, {
        fullname: user.full_name,
        phone: user.phone,
        email: localEmail
      });

      sessionStorage.setItem(
          "novaps_customer",
          JSON.stringify(user)
      );

      // Bersihkan pesanan simulasi lama.
      localStorage.removeItem("novaps_orders");

      console.log("Login berhasil. Redirect...");

      window.location.href = "../index.html";

    } catch (error) {
      showError(error.message);

      button.disabled = false;
      button.textContent = "Login";
    }
  });
})();
