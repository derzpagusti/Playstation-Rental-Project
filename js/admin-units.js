/*
 * Admin Unit: edit price, total and maintenance units.
 * Requires js/shared/session.js, admin.js, orders.js and admin-ui.js.
 * Customer pages read the same data, so changes show up there immediately.
 */
(function () {
  var ui = NovaAdmin;
  var modal = ui.modal(ui.$("unitModal"));
  var form = ui.$("unit-form");
  var fPrice = ui.$("f-price");
  var fTotal = ui.$("f-total");
  var fMaintenance = ui.$("f-maintenance");
  var editing = null;

  function render() {
    var units = NovaPS.units.all();
    var head = ui.$("units-head");
    var body = ui.$("units-body");
    head.textContent = "";
    body.textContent = "";
    head.appendChild(
      ui.headRow([
        "Unit Type",
        "Price/day",
        "Total Unit",
        "Available",
        "Rent",
        "Maintenance",
        "",
      ]),
    );

    Object.keys(units).forEach(function (key) {
      var u = units[key];
      var tr = ui.el("tr");
      tr.appendChild(ui.cell(u.name, "font-semibold"));
      tr.appendChild(ui.cell(NovaPS.money(u.price)));
      tr.appendChild(ui.cell(String(u.total)));
      var low = u.available <= NovaPS.LOW_STOCK;
      tr.appendChild(
        ui.cell(
          u.available === 0 ? "0 (sold out)" : String(u.available),
          u.available === 0 ? "text-red-600" : low ? "text-yellow-600" : "",
        ),
      );
      tr.appendChild(ui.cell(String(u.rented)));
      tr.appendChild(ui.cell(String(u.maintenance)));
      tr.appendChild(
        ui.cell(
          ui.lookButton(function () {
            openEditor(key);
          }, "Edit"),
          "text-right",
        ),
      );
      body.appendChild(tr);
    });
  }

  function preview() {
    var rented = NovaPS.units.get(editing).rented;
    var available = Number(fTotal.value) - Number(fMaintenance.value) - rented;
    ui.$("f-rented").textContent = rented;
    ui.$("f-available").textContent = isNaN(available)
      ? "-"
      : Math.max(0, available);
  }

  function setError(field, text) {
    var box = field.closest("[data-field]");
    box.toggleAttribute("data-invalid", !!text);
    box.querySelector("[data-error]").textContent = text;
  }

  function openEditor(key) {
    editing = key;
    var u = NovaPS.units.get(key);
    ui.$("unitModalTitle").textContent = "Edit " + u.name;
    fPrice.value = u.price;
    fTotal.value = u.total;
    fMaintenance.value = u.maintenance;
    [fPrice, fTotal, fMaintenance].forEach(function (f) {
      setError(f, "");
    });
    ui.$("unit-error").textContent = "";
    preview();
    modal.open();
  }

  [fTotal, fMaintenance].forEach(function (f) {
    f.addEventListener("input", preview);
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    ui.$("unit-error").textContent = "";
    try {
      // TODO: save to the database through the backend API.
      var u = NovaPS.units.set(editing, {
        price: fPrice.value,
        total: fTotal.value,
        maintenance: fMaintenance.value,
      });
      modal.close();
      render();
      ui.toast(u.name + " updated");
    } catch (err) {
      ui.$("unit-error").textContent = err.message;
    }
  });

  render();
  window.addEventListener("storage", render);
  setInterval(function () {
    if (!document.getElementById("unitModal").hasAttribute("data-open"))
      render();
  }, 5000);
})();
