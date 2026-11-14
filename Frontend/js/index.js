/*
 * Home page: live stock, order buttons, "login required" and
 * "unpaid order" pop-ups.
 * Requires js/shared/session.js and js/shared/orders.js.
 */
(function () {
  function Modal(el, focusSelector) {
    var lastFocus = null;
    return {
      isOpen: function () {
        return el.hasAttribute("data-open");
      },
      open: function () {
        lastFocus = document.activeElement;
        el.setAttribute("data-open", ""); // Tailwind: data-[open]:...
        el.setAttribute("aria-hidden", "false");
        document.body.classList.add("overflow-hidden");
        setTimeout(function () {
          var target = el.querySelector(focusSelector);
          if (target) target.focus();
        }, 50);
      },
      close: function () {
        if (!el.hasAttribute("data-open")) return;
        el.removeAttribute("data-open");
        el.setAttribute("aria-hidden", "true");
        document.body.classList.remove("overflow-hidden");
        if (lastFocus) lastFocus.focus();
      },
    };
  }

  var loginEl = document.getElementById("loginModal");
  var unpaidEl = document.getElementById("unpaidModal");
  var loginModal = Modal(loginEl, "a");
  var unpaidModal = Modal(unpaidEl, "a");

  [
    [loginEl, loginModal],
    [unpaidEl, unpaidModal],
  ].forEach(function (pair) {
    pair[0].addEventListener("click", function (e) {
      if (e.target === pair[0] || e.target.hasAttribute("data-close"))
        pair[1].close();
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      loginModal.close();
      unpaidModal.close();
    }
  });

  /* ---------- live stock on the unit cards ---------- */

  const unitMessage = document.getElementById("unitsMessage");

  const rupiah = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

  let loadingUnits = false;

  function renderUnits(devices) {
    for (const category of ["PS4", "PS5"]) {
      const key = category.toLowerCase();
      const units = devices.filter(device => device.category === category);

      const availableCount = units.filter(
          device => device.status === "Available" && !device.is_rented
      ).length;

      const stockElement = document.querySelector(`[data-stock="${key}"]`);
      const priceElement = document.querySelector(`[data-price="${key}"]`);

      stockElement.textContent = `Available now: ${availableCount}`;

      if (units.length === 0) {
        priceElement.textContent = "—";
        continue;
      }

      const prices = units.map(device => device.price_per_day);
      const lowestPrice = Math.min(...prices);
      const differentPrices = prices.some(price => price !== lowestPrice);

      priceElement.textContent =
          (differentPrices ? "From " : "") + rupiah.format(lowestPrice);
    }
  }

  async function updateStock() {
    if (loadingUnits || document.hidden) {
      return;
    }

    loadingUnits = true;

    try {
      const devices = await NovaPS.api.get("devices/list.php");

      if (!Array.isArray(devices)) {
        throw new Error("Format daftar device tidak sesuai.");
      }

      renderUnits(devices);

      unitMessage.textContent = devices.length === 0
          ? "No units are listed yet."
          : "";
    } catch (error) {
      document.querySelectorAll("[data-stock]").forEach(element => {
        element.textContent = "Unable to load";
      });

      document.querySelectorAll("[data-price]").forEach(element => {
        element.textContent = "—";
      });

      unitMessage.textContent =
          "Unable to load units. Please try again shortly.";

      console.error("Failed to load units:", error);
    } finally {
      loadingUnits = false;
    }
  }

  /* ---------- unpaid order pop-up ---------- */

  var unpaidTimer = null;

  function showUnpaid(order) {
    document.getElementById("unpaidPay").href =
      "pages/payment.html?order=" + encodeURIComponent(order.id);
    document.getElementById("unpaidInfo").textContent =
      order.id + " · " + NovaPS.money(order.total);

    function tick() {
      var current = NovaPS.orders.get(order.id);
      if (!current || current.status !== "not_paid") {
        // paid elsewhere or the 5 minutes are over (canceled + stock restored)
        clearInterval(unpaidTimer);
        unpaidModal.close();
        updateStock();
        return;
      }
      document.getElementById("unpaidCountdown").textContent =
        NovaPS.formatClock(NovaPS.orders.msLeft(current), true);
    }

    tick();
    clearInterval(unpaidTimer);
    unpaidTimer = setInterval(tick, 1000);
    unpaidModal.open();
  }

  /* ---------- every Order Now / Choose & Rent button ---------- */

  document.querySelectorAll("[data-order]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      if (!NovaPS.isLoggedIn()) {
        e.preventDefault();
        loginModal.open();
        return;
      }
      var unpaid = NovaPS.orders.unpaid();
      if (unpaid) {
        e.preventDefault(); // no new order before the current one is paid
        showUnpaid(unpaid);
      }
      // otherwise the link opens the order form
    });
  });

  updateStock();

  window.addEventListener("pageshow", updateStock);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      updateStock();
    }
  });

  setInterval(updateStock, 15000);

  // Remind logged-in users about an unpaid order as soon as the home page opens
  if (NovaPS.isLoggedIn()) {
    var waiting = NovaPS.orders.unpaid();
    if (waiting) showUnpaid(waiting);
  }
})();
