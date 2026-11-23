/*
 * Admin Users: everyone who signed up / logged in, with the option to block.
 * Requires js/shared/session.js, admin.js, orders.js and admin-ui.js.
 * Demo: only accounts used in this browser are listed.
 */
(function () {
  var ui = NovaAdmin;
  var modal = ui.modal(ui.$("userModal"));
  var search = ui.$("search");
  var body = ui.$("userBody");
  var actions = ui.$("userActions");
  var blockBox = ui.$("blockBox");
  var current = null; // email of the user in the pop-up

  function ordersOf(email) {
    var key = email.toLowerCase();
    return NovaPS.orders.adminAll().filter(function (o) {
      return o.owner === key;
    });
  }

  function when(iso) {
    return iso ? NovaPS.formatDate(iso) + ", " + NovaPS.formatTime(iso) : "-";
  }

  function statusBadge(user) {
    return user.blocked
      ? ui.el("span", "font-semibold text-red-600", "Blocked")
      : ui.el("span", "text-green-600", "Active");
  }

  /* ---------- table ---------- */

  function render() {
    var text = search.value.trim().toLowerCase();
    var list = NovaPS.users.all().filter(function (u) {
      return (
        [u.fullname, u.email, u.phone].join(" ").toLowerCase().indexOf(text) !==
        -1
      );
    });

    var head = ui.$("users-head");
    var tbody = ui.$("users-body");
    head.textContent = "";
    tbody.textContent = "";
    head.appendChild(
      ui.headRow([
        "Name",
        "Email",
        "No. WA",
        "Total Order",
        "Status",
        "Last login",
        "",
      ]),
    );

    list.forEach(function (user) {
      var tr = ui.el("tr");
      tr.appendChild(ui.cell(user.fullname || "-"));
      tr.appendChild(ui.cell(user.email));
      tr.appendChild(ui.cell(user.phone || "-"));
      tr.appendChild(ui.cell(String(ordersOf(user.email).length)));
      tr.appendChild(ui.cell(statusBadge(user)));
      tr.appendChild(
        ui.cell(
          user.lastLoginAt ? NovaPS.formatDate(user.lastLoginAt) : "-",
          "text-sm",
        ),
      );
      tr.appendChild(
        ui.cell(
          ui.lookButton(function () {
            show(user.email);
            modal.open();
          }),
          "text-right",
        ),
      );
      tbody.appendChild(tr);
    });
    ui.$("users-empty").hidden = list.length > 0;
  }

  /* ---------- user detail ---------- */

  function show(email) {
    current = email;
    var user = NovaPS.users.get(email);
    var orders = ordersOf(email);
    body.textContent = "";
    actions.textContent = "";
    blockBox.hidden = true;
    ui.$("blockReason").value = "";
    if (!user) return;

    var done = orders.filter(function (o) {
      return o.status === "complete" || o.status === "returned";
    });
    var spent = done.reduce(function (sum, o) {
      return sum + o.total;
    }, 0);

    var info = ui.section(body, "Account");
    ui.kv(info, "Name", user.fullname || "-");
    ui.kv(info, "Email", user.email);
    ui.kv(info, "WhatsApp", user.phone || "-");
    ui.kv(info, "Address", user.address || "-");
    ui.kv(info, "Joined", when(user.joinedAt));
    ui.kv(info, "Last login", when(user.lastLoginAt));
    ui.kv(info, "Status", "").lastChild.replaceWith(statusBadge(user));
    if (user.blocked) {
      ui.kv(info, "Blocked on", when(user.blockedAt));
      if (user.blockReason) ui.kv(info, "Note", user.blockReason);
    }

    var card = ui.section(body, "ID card");
    ui.picture(
      card,
      user.idcard,
      "ID card of " + (user.fullname || user.email),
    );

    var stats = ui.section(body, "Orders");
    ui.kv(stats, "Total orders", String(orders.length));
    ui.kv(stats, "Completed", String(done.length));
    ui.kv(stats, "Total spent", NovaPS.money(spent), "font-semibold");
    orders.slice(0, 5).forEach(function (order) {
      var row = ui.kv(
        stats,
        NovaPS.formatDate(order.createdAt) +
          " · " +
          ui.unitNames(order).join(" + "),
        "",
      );
      row.lastChild.replaceWith(ui.statusCell(order));
    });
    if (orders.length > 5)
      stats.appendChild(
        ui.el(
          "p",
          "mt-1 text-xs text-slate-400",
          "Showing the latest 5 orders.",
        ),
      );

    var btn = ui.el(
      "button",
      user.blocked
        ? "btn btn-indigo px-4 py-2 text-sm font-semibold"
        : "btn border-red-600 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-600 hover:text-white",
      user.blocked ? "Unblock user" : "Block user",
    );
    btn.type = "button";
    btn.addEventListener("click", function () {
      if (user.blocked) {
        // TODO: update the user in the database through the backend API.
        NovaPS.users.setBlocked(user.email, false);
        ui.toast("User unblocked");
        show(user.email);
        render();
      } else {
        blockBox.hidden = false;
        ui.$("blockReason").focus();
      }
    });
    actions.appendChild(btn);
  }

  ui.$("cancelBlock").addEventListener("click", function () {
    blockBox.hidden = true;
  });
  ui.$("confirmBlock").addEventListener("click", function () {
    NovaPS.users.setBlocked(current, true, ui.$("blockReason").value.trim());
    ui.toast("User blocked");
    show(current);
    render();
  });

  search.addEventListener("input", render);
  render();
  window.addEventListener("storage", render);
})();
