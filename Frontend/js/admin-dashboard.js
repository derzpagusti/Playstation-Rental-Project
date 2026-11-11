/*
 * Admin Dashboard: status totals, orders that need verification, sales.
 * Requires js/shared/session.js, admin.js, orders.js and admin-ui.js.
 */
(function () {
  var ui = NovaAdmin;
  var DONE = ["complete", "returned"]; // a finished sale

  var orderModal = ui.orderModal(render);

  function isDone(order) {
    return DONE.indexOf(order.status) !== -1;
  }

  // Sales are counted in the month the unit was delivered
  function monthKey(order) {
    var d = new Date(order.completedAt || order.createdAt);
    return d.getFullYear() + "-" + (d.getMonth() + 1);
  }

  function countStatuses(orders) {
    var counts = {
      not_paid: 0,
      pending: 0,
      shipped: 0,
      completed: 0,
      canceled: 0,
      rejected: 0,
    };
    orders.forEach(function (order) {
      counts[isDone(order) ? "completed" : order.status]++;
    });
    document.querySelectorAll("[data-count]").forEach(function (card) {
      card.querySelector("[data-value]").textContent =
        counts[card.dataset.count];
    });
  }

  /* ---------- orders that need the admin ---------- */

  function renderQueue(orders) {
    var queue = orders
      .filter(function (o) {
        return o.status === "pending" || o.status === "shipped";
      })
      .sort(function (a, b) {
        return a.createdAt.localeCompare(b.createdAt); // longest waiting first
      });

    var head = ui.$("queue-head");
    var body = ui.$("queue-body");
    head.textContent = "";
    body.textContent = "";
    head.appendChild(
      ui.headRow([
        "Customer Name",
        "Unit Type",
        "Total Unit",
        "Duration",
        "Total",
        "Date",
        "Status",
        "",
      ]),
    );

    queue.forEach(function (order) {
      var tr = ui.el("tr");
      tr.appendChild(ui.cell(order.customer.fullname));
      tr.appendChild(ui.cell(ui.stack(ui.unitNames(order))));
      tr.appendChild(ui.cell(ui.stack(ui.unitCounts(order))));
      tr.appendChild(ui.cell(ui.stack(ui.durationLines(order))));
      tr.appendChild(ui.cell(NovaPS.money(order.total)));
      tr.appendChild(ui.cell(ui.dateCell(order.createdAt)));
      tr.appendChild(ui.cell(ui.statusCell(order)));
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

    ui.$("queue-empty").hidden = queue.length > 0;
  }

  /* ---------- sales ---------- */

  function renderSales(orders) {
    var done = orders.filter(isDone);
    var now = new Date();
    var thisMonth = now.getFullYear() + "-" + (now.getMonth() + 1);

    function sum(list, pick) {
      return list.reduce(function (total, order) {
        return total + pick(order);
      }, 0);
    }
    // Extensions add income (and late fees), but no extra unit
    var units = function (o) {
      return o.type === "extend" ? 0 : o.items.length;
    };
    var income = function (o) {
      return o.total + (o.lateFee || 0);
    };
    var month = done.filter(function (o) {
      return monthKey(o) === thisMonth;
    });

    function set(key, text) {
      document.querySelector('[data-metric="' + key + '"]').textContent = text;
    }
    set("units-total", sum(done, units));
    set("units-month", sum(month, units));
    set("revenue-total", NovaPS.money(sum(done, income)));
    set("revenue-month", NovaPS.money(sum(month, income)));

    var running = orders.filter(function (o) {
      return o.status === "pending" || o.status === "shipped";
    });
    ui.$("in-progress").textContent = NovaPS.money(sum(running, income));

    // Last 6 months (newest first)
    var months = [];
    for (var i = 0; i < 6; i++) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: d.getFullYear() + "-" + (d.getMonth() + 1),
        label: ui.MONTHS[d.getMonth()] + " " + d.getFullYear(),
      });
    }
    var rows = months.map(function (m) {
      var list = done.filter(function (o) {
        return monthKey(o) === m.key;
      });
      var per = { ps4: 0, ps5: 0 };
      list.forEach(function (o) {
        if (o.type === "extend") return;
        o.items.forEach(function (item) {
          per[item.unit]++;
        });
      });
      return {
        label: m.label,
        ps4: per.ps4,
        ps5: per.ps5,
        units: sum(list, units),
        revenue: sum(list, income),
      };
    });
    var max = Math.max.apply(
      null,
      rows
        .map(function (r) {
          return r.revenue;
        })
        .concat(1),
    );

    var head = ui.$("month-head");
    var body = ui.$("month-body");
    head.textContent = "";
    body.textContent = "";
    head.appendChild(
      ui.headRow(["Month", "PS4", "PS5", "Total units", "Income"]),
    );

    rows.forEach(function (r) {
      var tr = ui.el("tr");
      tr.appendChild(ui.cell(r.label));
      tr.appendChild(ui.cell(String(r.ps4)));
      tr.appendChild(ui.cell(String(r.ps5)));
      tr.appendChild(ui.cell(String(r.units)));

      var income = ui.el("div", "min-w-[160px]");
      income.appendChild(ui.el("span", "", NovaPS.money(r.revenue)));
      var track = ui.el("div", "mt-1 h-1.5 rounded-full bg-slate-100");
      var bar = ui.el(
        "div",
        "h-full rounded-full bg-indigo-500 transition-all duration-500",
      );
      bar.style.width = Math.round((r.revenue / max) * 100) + "%";
      track.appendChild(bar);
      income.appendChild(track);
      tr.appendChild(ui.cell(income));
      body.appendChild(tr);
    });
  }

  function render() {
    var orders = NovaPS.orders.adminAll();
    countStatuses(orders);
    renderQueue(orders);
    renderSales(orders);
  }

  render();
  // Keep the numbers fresh while customers order in another tab
  window.addEventListener("storage", render);
  setInterval(render, 5000);
})();
