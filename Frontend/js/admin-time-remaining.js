/*
 * Admin Time Remaining: every rental that is in a customer's hands, with a
 * live countdown (most urgent first). Requires js/shared/session.js, admin.js,
 * orders.js and admin-ui.js.
 */
(function () {
  var ui = NovaAdmin;
  var search = ui.$("search");
  var filter = ui.$("status-filter");
  var orderModal = ui.orderModal(render);
  var pills = []; // { el, order, key }

  function pillClass(ms) {
    return (
      "rounded-md px-2.5 py-0.5 text-sm text-white tabular-nums " +
      NovaPS.rentalTone(ms).pill
    );
  }

  function rentals() {
    return NovaPS.orders.adminAll().filter(function (o) {
      return o.type !== "extend" && o.status === "complete";
    });
  }

  function matches(order, text, status) {
    var left = NovaPS.rentals.msLeft(order);
    if (status === "overdue" && left > 0) return false;
    if (status === "h1" && !(left > 0 && left <= NovaPS.HOUR_MS)) return false;
    if (status === "h4" && !(left > 0 && left <= 4 * NovaPS.HOUR_MS))
      return false;
    if (status === "over4" && left <= 4 * NovaPS.HOUR_MS) return false;
    if (!text) return true;
    var haystack = [
      order.customer.fullname,
      order.customer.email,
      order.customer.phone,
      order.id,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.indexOf(text) !== -1;
  }

  function counters(all) {
    var h = NovaPS.HOUR_MS;
    var count = { all: all.length, h4: 0, h1: 0, overdue: 0 };
    all.forEach(function (o) {
      var left = NovaPS.rentals.msLeft(o);
      if (left <= 0) count.overdue++;
      else {
        if (left <= 4 * h) count.h4++;
        if (left <= h) count.h1++;
      }
    });
    document.querySelectorAll("[data-chip]").forEach(function (chip) {
      chip.querySelector("[data-chip-value]").textContent =
        count[chip.dataset.chip];
    });
  }

  function render() {
    var all = rentals();
    counters(all);
    var text = search.value.trim().toLowerCase();
    var list = all
      .filter(function (o) {
        return matches(o, text, filter.value);
      })
      .sort(function (a, b) {
        return NovaPS.rentals.dueAt(a) - NovaPS.rentals.dueAt(b); // most urgent first
      });

    var head = ui.$("tr-head");
    var body = ui.$("tr-body");
    head.textContent = "";
    body.textContent = "";
    pills = [];
    head.appendChild(
      ui.headRow([
        "Customer Name",
        "Unit Type",
        "Total Unit",
        "Duration",
        "Delivered",
        "Time Remaining",
        "",
      ]),
    );

    list.forEach(function (order) {
      var tr = ui.el("tr");
      tr.appendChild(ui.cell(order.customer.fullname));
      tr.appendChild(ui.cell(ui.stack(ui.unitNames(order))));
      tr.appendChild(ui.cell(ui.stack(ui.unitCounts(order))));
      var days = ui.durationLines(order);
      if (order.extraDays)
        days.push("+" + NovaPS.formatDays(order.extraDays) + " (Extend)");
      tr.appendChild(ui.cell(ui.stack(days)));
      tr.appendChild(
        ui.cell(ui.dateCell(order.completedAt || order.createdAt)),
      );

      var left = NovaPS.rentals.msLeft(order);
      var pill = ui.el("span", pillClass(left), NovaPS.formatHMS(left));
      pills.push({ el: pill, order: order, key: NovaPS.rentalTone(left).key });
      var timeCell = ui.el("div", "leading-tight");
      timeCell.appendChild(pill);
      if (NovaPS.rentals.pendingExtension(order)) {
        timeCell.appendChild(
          ui.el(
            "p",
            "mt-1 text-xs text-indigo-500",
            "Extension waiting (clock paused)",
          ),
        );
      }
      tr.appendChild(ui.cell(timeCell));

      tr.appendChild(
        ui.cell(
          ui.lookButton(function () {
            orderModal.open(order.id);
          }),
          "text-right",
        ),
      );
      body.appendChild(tr);
    });
    ui.$("tr-empty").hidden = list.length > 0;
  }

  // Every second: only the numbers change (so buttons stay clickable)
  function tick() {
    var changed = false;
    pills.forEach(function (p) {
      var left = NovaPS.rentals.msLeft(p.order);
      p.el.textContent = NovaPS.formatHMS(left);
      p.el.className = pillClass(left);
      if (NovaPS.rentalTone(left).key !== p.key) changed = true; // counters / filters need a refresh
    });
    if (changed) render();
  }

  document.querySelectorAll("[data-chip]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      filter.value = chip.dataset.chip === "all" ? "all" : chip.dataset.chip;
      render();
    });
  });
  search.addEventListener("input", render);
  filter.addEventListener("change", render);

  render();
  setInterval(tick, 1000);
  setInterval(render, 5000);
  window.addEventListener("storage", render);
})();
