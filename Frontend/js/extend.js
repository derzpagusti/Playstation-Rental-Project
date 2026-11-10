/*
 * Extend Rental page (?order=<id of a rental that is in your hands>).
 * Requires js/shared/session.js and orders.js.
 *
 * A rental can last 7 days in total. If it is overdue, the late fee
 * (Rp 1.000 per minute) is added to the price of the extension.
 */
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  var id = new URLSearchParams(location.search).get("order");

  // Only one unpaid order at a time: send the customer home, where the pop-up explains it
  if (NovaPS.orders.unpaid()) {
    location.replace("../index.html");
    return;
  }

  var parent = id ? NovaPS.orders.get(id) : null;
  if (!parent || parent.type === "extend" || parent.status !== "complete") {
    location.replace("time-remaining.html");
    return;
  }

  if (NovaPS.rentals.pendingExtension(parent)) {
    location.replace("time-remaining.html"); // wait for the admin first
    return;
  }

  var select = $("days");
  var checkout = $("checkout");
  var hint = $("checkout-hint");
  var formError = $("form-error");
  var max = NovaPS.rentals.maxExtend(parent);

  /* ---------- duration choices ---------- */

  function addOption(value, label) {
    var option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  addOption("", "-- day");
  for (var d = 1; d <= max; d++) addOption(String(d), NovaPS.formatDays(d));
  select.disabled = max === 0;
  $("days-hint").textContent =
    max === 0
      ? "This rental already has the maximum of " +
        NovaPS.MAX_TOTAL_DAYS +
        " days."
      : "Max. " +
        NovaPS.MAX_TOTAL_DAYS +
        " days in total: you can add up to " +
        NovaPS.formatDays(max) +
        ".";

  /* ---------- live numbers ---------- */

  function refresh() {
    parent = NovaPS.orders.get(id) || parent;
    if (parent.status !== "complete") {
      location.replace("time-remaining.html"); // returned in the meantime
      return;
    }

    var left = NovaPS.rentals.msLeft(parent);
    var due = new Date(NovaPS.rentals.dueAt(parent)).toISOString();
    NovaPS.renderRows($("current-rows"), [
      { label: "Order ID", value: parent.id },
      {
        label: "Unit",
        value: parent.items
          .map(function (i) {
            return NovaPS.PRODUCTS[i.unit].name;
          })
          .join(" + "),
      },
      {
        label: "Rental duration",
        value: NovaPS.formatDays(NovaPS.rentals.totalDays(parent)),
      },
      {
        label: "Return before",
        value: NovaPS.formatDate(due) + ", " + NovaPS.formatTime(due),
      },
      {
        label: "Time remaining",
        value: NovaPS.formatHMS(left),
        valueClass: NovaPS.rentalTone(left).text + " font-semibold",
      },
    ]);

    var fine = NovaPS.rentals.fine(parent);
    var note = $("overdue-note");
    note.hidden = fine === 0;
    if (fine) {
      note.textContent =
        "Your rental is overdue. A late fee of " +
        NovaPS.money(NovaPS.FINE_PER_MIN) +
        " per minute is added to the extension: " +
        NovaPS.money(fine) +
        " so far (" +
        NovaPS.rentals.fineMinutes(parent) +
        " min).";
    }

    var days = Number(select.value);
    var summary = $("summary");
    summary.hidden = !days;
    if (days) {
      var items = parent.items.map(function (item) {
        return {
          unit: item.unit,
          days: days,
          price: NovaPS.PRODUCTS[item.unit].price * days,
        };
      });
      var sum = items.reduce(function (t, item) {
        return t + item.price;
      }, 0);
      NovaPS.renderRows(
        $("summary-rows"),
        NovaPS.summaryRows({
          customer: parent.customer,
          items: items,
          type: "extend",
          fine: fine,
          fineMinutes: NovaPS.rentals.fineMinutes(parent),
          total: sum + fine,
        }),
      );
    }

    checkout.disabled = !days;
    hint.textContent =
      days || max === 0 ? "" : "Choose the extra duration to continue.";
  }

  select.addEventListener("change", refresh);

  /* ---------- checkout ---------- */

  $("extend-form").addEventListener("submit", function (e) {
    e.preventDefault();
    formError.textContent = "";
    if (checkout.disabled) return;

    checkout.disabled = true;
    checkout.textContent = "Please wait…";
    try {
      // TODO: send the extension to the backend API.
      var order = NovaPS.orders.createExtension(id, select.value);
      location.href = "payment.html?order=" + encodeURIComponent(order.id);
    } catch (err) {
      formError.textContent = err.message;
      checkout.textContent = "Checkout";
      refresh();
    }
  });

  refresh();
  setInterval(refresh, 1000);
})();
