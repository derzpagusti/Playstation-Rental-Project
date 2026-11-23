/*
 * Admin Time Remaining: every UNIT that is in a customer's hands, each with
 * its own live countdown (most urgent first). Requires js/shared/session.js,
 * admin.js, orders.js and admin-ui.js.
 */
(function () {
  var ui = NovaAdmin;
  var search = ui.$("search");
  var filter = ui.$("status-filter");
  var orderModal = ui.orderModal(render);
  var pills = []; // { el, entry, key }

  function pillClass(ms) {
    return (
      "rounded-md px-2.5 py-0.5 text-sm text-white tabular-nums " +
      NovaPS.rentalTone(ms).pill
    );
  }

  function matches(entry, text, status) {
    var left = NovaPS.rentals.msLeft(entry);
    if (status === "overdue" && left > 0) return false;
    if (status === "h1" && !(left > 0 && left <= NovaPS.HOUR_MS)) return false;
    if (status === "h4" && !(left > 0 && left <= 4 * NovaPS.HOUR_MS))
      return false;
    if (status === "over4" && left <= 4 * NovaPS.HOUR_MS) return false;
    if (!text) return true;
    var c = entry.order.customer;
    return (
      [c.fullname, c.email, c.phone, entry.order.id]
        .join(" ")
        .toLowerCase()
        .indexOf(text) !== -1
    );
  }

  function counters(all) {
    var h = NovaPS.HOUR_MS;
    var count = { all: all.length, h4: 0, h1: 0, overdue: 0 };
    all.forEach(function (e) {
      var left = NovaPS.rentals.msLeft(e);
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
    var all = NovaPS.rentals.adminActive(); // one entry per unit, most urgent first
    counters(all);
    var text = search.value.trim().toLowerCase();
    var list = all.filter(function (e) {
      return matches(e, text, filter.value);
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

    list.forEach(function (entry) {
      var order = entry.order;
      var item = entry.item;
      var many = order.items.length > 1;
      var name = NovaPS.PRODUCTS[item.unit].name;
      var tr = ui.el("tr");
      tr.appendChild(ui.cell(order.customer.fullname));
      tr.appendChild(
        ui.cell(name + (many ? " · Unit #" + (entry.index + 1) : "")),
      );
      tr.appendChild(ui.cell("1"));
      var days = [NovaPS.formatDays(item.days)];
      if (item.extraDays)
        days.push("+" + NovaPS.formatDays(item.extraDays) + " (Extend)");
      tr.appendChild(ui.cell(ui.stack(days)));
      tr.appendChild(
        ui.cell(ui.dateCell(order.completedAt || order.createdAt)),
      );

      var left = NovaPS.rentals.msLeft(entry);
      var pill = ui.el("span", pillClass(left), NovaPS.formatHMS(left));
      pills.push({ el: pill, entry: entry, key: NovaPS.rentalTone(left).key });
      var timeCell = ui.el("div", "leading-tight");
      timeCell.appendChild(pill);
      if (NovaPS.rentals.pendingExtension(entry)) {
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
      var left = NovaPS.rentals.msLeft(p.entry);
      p.el.textContent = NovaPS.formatHMS(left);
      p.el.className = pillClass(left);
      if (NovaPS.rentalTone(left).key !== p.key) changed = true; // counters / filters need a refresh
    });
    if (changed) render();
  }

  document.querySelectorAll("[data-chip]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      filter.value = chip.dataset.chip;
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
