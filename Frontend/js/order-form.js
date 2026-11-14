
/*
 * NovaPS - Order Form
 * Integrasi frontend lokal dengan backend PHP.
 */
(function () {
  const API_BASE = "/playstation/backend/public/api";

  const form = document.getElementById("order-form");
  const unitsEl = document.getElementById("units");
  const template = document.getElementById("unit-template");
  const addWrap = document.getElementById("add-unit-wrap");
  const checkout = document.getElementById("checkout");
  const hint = document.getElementById("checkout-hint");
  const formError = document.getElementById("form-error");
  const summary = document.getElementById("summary");
  const summaryRows = document.getElementById("summary-rows");

  if (!form || !template) {
    console.error("Elemen Order Form tidak lengkap.", {
      form,
      template
    });
    return;
  }

  const blocks = [];

  // Informasi customer hanya untuk tampilan.
  // Backend mengambil data customer dari session PHP.

  const customer = JSON.parse(
      sessionStorage.getItem("novaps_customer") || "null"
  );

  const customerSection = form.querySelector("section");

  if (customerSection && customer) {
    const profileFields = {
      fullname: customer.full_name || "",
      phone: customer.phone || "",
      address: customer.address || "",
      email: customer.email || ""
    };

    Object.entries(profileFields).forEach(([id, value]) => {
      const input = document.getElementById(id);

      if (!input) return;

      input.value = value;
      input.readOnly = true;
      input.placeholder = value
          ? ""
          : "Data belum tersedia dari backend";

      // Data profil tidak diedit saat checkout.
      input.removeAttribute("data-validate");
    });

    const idInput = document.getElementById("idcard");
    const upload = customerSection.querySelector("[data-upload]");
    const customerHint = document.getElementById("customer-hint");

    if (idInput) {
      idInput.disabled = true;
      idInput.removeAttribute("data-validate");
    }

    if (upload) {
      upload.style.display = "none";
    }

    if (customerHint) {
      customerHint.textContent =
          customer.identity_doc_verified
              ? "Identitas sudah diverifikasi. Data profil diambil dari akun customer."
              : "Identitas belum diverifikasi. Checkout belum dapat dilakukan.";
    }
  }


  function showMessage(message) {
    formError.textContent = message;
    formError.style.whiteSpace = "pre-line";
  }

  async function getAPI(path) {
    const response = await fetch(`${API_BASE}/${path}`, {
      credentials: "same-origin",
      cache: "no-store"
    });

    const result = await response.json();

    if (!response.ok || result.success !== true) {
      throw new Error(result.message || "Gagal mengambil data.");
    }

    return result.data;
  }

  async function postAPI(path, body) {
    const response = await fetch(`${API_BASE}/${path}`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const result = await response.json();

    if (!response.ok || result.success !== true) {
      throw new Error(result.message || "Checkout gagal.");
    }

    return result.data;
  }

  function unitOf(block) {
    const selected = block.querySelector(
        'input[type="radio"]:checked'
    );

    return selected ? selected.value : "";
  }

  function daysOf(block) {
    return Number(
        block.querySelector("[data-duration]").value
    );
  }


  function getCurrentWIB() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date());

    const values = Object.fromEntries(
        parts.map(part => [part.type, part.value])
    );

    return (
        `${values.year}-${values.month}-${values.day}` +
        `T${values.hour}:${values.minute}:${values.second}`
    );
  }

  function renumber() {
    blocks.forEach((block, index) => {
      block.querySelector("[data-unit-title]").textContent =
          blocks.length > 1
              ? `Select a Unit #${index + 1}`
              : "Select a Unit";

      block.querySelector("[data-remove-unit]").hidden =
          index === 0;

      block.querySelectorAll('input[type="radio"]').forEach(
          radio => {
            radio.name = `unit-${index + 1}`;
          }
      );
    });

    addWrap.hidden = blocks.length >= 2;
  }

  function addBlock() {
    const block = template.content.firstElementChild.cloneNode(true);

    unitsEl.appendChild(block);
    blocks.push(block);

    block.addEventListener("change", refresh);

    block.querySelector("[data-remove-unit]").addEventListener(
        "click",
        () => {
          const index = blocks.indexOf(block);

          blocks.splice(index, 1);
          block.remove();

          renumber();
          refresh();
        }
    );

    renumber();
    refresh();

    return block;
  }

  document.getElementById("add-unit").addEventListener(
      "click",
      () => addBlock()
  );

  // Harga hanya estimasi untuk tampilan.
  // Total pembayaran resmi dihitung backend.
  const prices = {
    ps4: 50000,
    ps5: 100000
  };

  function refresh() {
    const items = blocks.map(block => ({
      unit: unitOf(block),
      days: daysOf(block)
    }));

    form.querySelectorAll("[data-price]").forEach(el => {
      el.textContent =
          NovaPS.money(prices[el.dataset.price]) + "/day";
    });

    blocks.forEach(block => {
      const selected = unitOf(block);
      const duration = block.querySelector("[data-duration]");

      duration.disabled = !selected;

      block.querySelectorAll("[data-available]").forEach(label => {
        label.textContent = "Check availability at checkout";
        label.className = "shrink-0 text-slate-500";
      });
    });

    const validItems = items.filter(item =>
        item.unit &&
        Number.isInteger(item.days) &&
        item.days >= 1 &&
        item.days <= 7
    );

    summary.hidden = validItems.length === 0;

    if (validItems.length) {
      const total = validItems.reduce(
          (sum, item) =>
              sum + prices[item.unit] * item.days,
          0
      );

      NovaPS.renderRows(
          summaryRows,
          NovaPS.summaryRows({
            customer: {
              fullname: customer?.full_name || "-",
              address: "Dari profil database"
            },
            items: validItems.map(item => ({
              unit: item.unit,
              days: item.days,
              price: prices[item.unit] * item.days
            })),
            total
          })
      );
    }

    const valid =
        items.length > 0 &&
        items.length === validItems.length;

    checkout.disabled = !valid;

    hint.textContent = !valid
        ? "Pilih PS dan durasi penyewaan."
        : "Waktu mulai sewa akan dihitung otomatis saat Checkout.";
  }

  // Cari device_id nyata dari database.
  async function resolveItems(startTime) {
    const usedIds = new Set();
    const result = [];

    for (const block of blocks) {
      const category = unitOf(block).toUpperCase();
      const durationDays = daysOf(block);

      const params = new URLSearchParams({
        start_time: startTime,
        duration_days: String(durationDays),
        category
      });

      console.log("GET devices/available.php", params.toString());

      const devices = await getAPI(
          `devices/available.php?${params.toString()}`
      );

      const device = devices.find(
          item => !usedIds.has(Number(item.device_id))
      );

      if (!device) {
        throw new Error(
            `Tidak ada ${category} yang tersedia pada jadwal ini.`
        );
      }

      usedIds.add(Number(device.device_id));

      result.push({
        device_id: Number(device.device_id),
        duration_days: durationDays
      });
    }

    return result;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    console.log("CHECKOUT TERPANGGIL");
    showMessage("");

    if (checkout.disabled) return;

    checkout.disabled = true;
    checkout.textContent = "Creating booking...";

    try {
      const checkTime = getCurrentWIB();

      console.log("Waktu pengecekan:", checkTime);

      const items = await resolveItems(checkTime);

      console.log("Device terpilih:", items);

      const booking = await postAPI(
          "bookings/create.php",
          {
            payment_method: "QRIS",
            items
          }
      );

      console.log("BOOKING BERHASIL:", booking);

      showMessage(
          `Booking berhasil!\n` +
          `Kode booking: ${booking.booking_code}\n` +
          `Total: ${NovaPS.money(booking.total_cost)}\n` +
          `Status: ${booking.payment.status}`
      );

      checkout.textContent = "Booking Created";
      checkout.disabled = true;

      // Tidak diarahkan ke payment.html dulu,
      // karena halaman pembayaran masih memakai localStorage.

    } catch (error) {
      console.error("CHECKOUT ERROR:", error);

      showMessage(error.message);

      checkout.disabled = false;
      checkout.textContent = "Checkout";
    }
  });

  const first = addBlock();

  const wanted = new URLSearchParams(
      location.search
  ).get("unit");

  if (wanted === "ps4" || wanted === "ps5") {
    const radio = first.querySelector(
        `input[value="${wanted}"]`
    );

    if (radio) {
      radio.checked = true;
    }
  }

  refresh();

  console.log("Order Form API integration loaded.");
})();
