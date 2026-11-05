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

  function updateStock() {
    document.querySelectorAll("[data-stock]").forEach(function (el) {
      var left = NovaPS.stock.get(el.dataset.stock);
      el.textContent = left > 0 ? "Available: " + left : "Sold out";
      el.classList.toggle(
        "text-yellow-600",
        left > 0 && left <= NovaPS.LOW_STOCK,
      );
      el.classList.toggle("text-red-600", left === 0);
    });
    document.querySelectorAll("[data-order-unit]").forEach(function (btn) {
      var soldOut = NovaPS.stock.get(btn.dataset.orderUnit) === 0;
      btn.setAttribute("aria-disabled", String(soldOut));
      btn.classList.toggle("pointer-events-none", soldOut);
      btn.classList.toggle("opacity-50", soldOut);
    });
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

  // Remind logged-in users about an unpaid order as soon as the home page opens
  if (NovaPS.isLoggedIn()) {
    var waiting = NovaPS.orders.unpaid();
    if (waiting) showUnpaid(waiting);
  }
})();
