/*
 * Admin Orders: full history (newest first) with search, status filter and
 * pages. Requires js/shared/session.js, admin.js, orders.js and admin-ui.js.
 */
(function () {
  var ui = NovaAdmin;
  var PAGE_SIZE = 10;
  var page = 1;

  var search = ui.$("search");
  var filter = ui.$("status-filter");
  var orderModal = ui.orderModal(render);

  // Coming from a Dashboard card: orders.html?status=pending
  var wanted = new URLSearchParams(location.search).get("status");
  if (wanted && filter.querySelector('option[value="' + wanted + '"]'))
    filter.value = wanted;

  function matches(order, text, status) {
    if (status === "overdue") {
      if (!(order.status === "returned" && order.returnedLate)) return false;
    } else if (status !== "all" && order.status !== status) {
      return false;
    }
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

  function render() {
    var text = search.value.trim().toLowerCase();
    var list = NovaPS.orders.adminAll().filter(function (o) {
      return matches(o, text, filter.value);
    });

    var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    page = Math.min(page, pages);
    var shown = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    var head = ui.$("orders-head");
    var body = ui.$("orders-body");
    head.textContent = "";
    body.textContent = "";
    head.appendChild(
      ui.headRow([
        "Customer Name",
        "Order ID",
        "Unit Type",
        "Total Unit",
        "Duration",
        "Total",
        "Date",
        "Status",
        "",
      ]),
    );

    shown.forEach(function (order) {
      var tr = ui.el("tr");
      tr.appendChild(ui.cell(order.customer.fullname));
      tr.appendChild(ui.cell(order.id, "text-xs text-slate-500"));
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

    ui.$("orders-empty").hidden = list.length > 0;
    ui.$("orders-count").textContent =
      "Showing " + shown.length + " of " + list.length + " orders";
    ui.$("page-label").textContent = "Page " + page + " of " + pages;
    ui.$("prev-page").disabled = page <= 1;
    ui.$("next-page").disabled = page >= pages;
  }

  search.addEventListener("input", function () {
    page = 1;
    render();
  });
  filter.addEventListener("change", function () {
    page = 1;
    render();
  });
  ui.$("prev-page").addEventListener("click", function () {
    page--;
    render();
  });
  ui.$("next-page").addEventListener("click", function () {
    page++;
    render();
  });

  render();
  window.addEventListener("storage", render);
  setInterval(render, 5000);
})();
