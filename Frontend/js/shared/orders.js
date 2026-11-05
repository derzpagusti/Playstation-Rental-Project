/*
 * Shared order system (stock, orders, 5-minute payment timer).
 * Requires js/shared/session.js.
 *
 * DEMO ONLY - stock and orders live in this browser's localStorage, so every
 * visitor has their own stock. A real backend/database must own this data.
 *
 *   NovaPS.orders.create / pay / cancel / get / all / unpaid / sweep
 *   NovaPS.stock.get(unit)
 *   NovaPS.summaryRows + NovaPS.renderRows   order summary lists
 *   NovaPS.money / formatDate / formatTime / formatDays / formatClock
 */
(function () {
  var ORDERS_KEY = "novaps_orders";
  var STOCK_KEY = "novaps_stock";
  var PAY_WINDOW_MS = 5 * 60 * 1000;

  var PRODUCTS = {
    ps4: { name: "PS4", label: "PS 4", price: 50000, stock: 10 },
    ps5: { name: "PS5", label: "PS 5", price: 200000, stock: 2 },
  };

  NovaPS.PRODUCTS = PRODUCTS;
  NovaPS.MAX_DAYS = 7;
  NovaPS.MAX_UNITS = 2;
  NovaPS.LOW_STOCK = 3;

  // Order statuses (admin-only ones are ready for the future dashboard)
  NovaPS.STATUS = {
    not_paid: { label: "Not Paid", text: "text-amber-600" },
    pending: { label: "Pending", text: "text-indigo-500" },
    shipped: { label: "Shipped", text: "text-sky-600" },
    complete: { label: "Complete", text: "text-green-600" },
    canceled: { label: "Canceled", text: "text-orange-700" },
    rejected: { label: "Rejected", text: "text-red-600" },
  };

  /* ---------- storage ---------- */

  function read(key, fallback) {
    try {
      var value = JSON.parse(localStorage.getItem(key));
      return value === null ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function owner() {
    return (NovaPS.profile.get().email || "").toLowerCase();
  }

  /* ---------- stock ---------- */

  function stockAll() {
    var saved = read(STOCK_KEY, {});
    var all = {};
    Object.keys(PRODUCTS).forEach(function (unit) {
      all[unit] =
        typeof saved[unit] === "number" ? saved[unit] : PRODUCTS[unit].stock;
    });
    return all;
  }

  function adjustStock(unit, delta) {
    var all = stockAll();
    all[unit] = Math.max(0, all[unit] + delta);
    write(STOCK_KEY, all);
  }

  NovaPS.stock = {
    get: function (unit) {
      NovaPS.orders.sweep();
      return stockAll()[unit];
    },
  };

  /* ---------- orders ---------- */

  function allOrders() {
    return read(ORDERS_KEY, []);
  }

  // Cancel an order that is still "not_paid" and give its units back to stock
  function cancelInPlace(order, reason, type) {
    order.status = "canceled";
    order.canceledAt = new Date().toISOString();
    order.cancelReason = reason;
    order.cancelType = type; // "user" or "expired"
    order.items.forEach(function (item) {
      adjustStock(item.unit, 1);
    });
  }

  // Auto-cancel every unpaid order whose 5 minutes are over
  function sweep() {
    var orders = allOrders();
    var changed = false;
    orders.forEach(function (order) {
      if (order.status === "not_paid" && order.expiresAt <= Date.now()) {
        cancelInPlace(order, "Payment time expired", "expired");
        changed = true;
      }
    });
    if (changed) write(ORDERS_KEY, orders);
  }

  function makeId() {
    var d = new Date();
    var pad = function (n) {
      return String(n).padStart(2, "0");
    };
    var rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return (
      "NV-" +
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      "-" +
      rand
    );
  }

  function total(items) {
    return items.reduce(function (sum, item) {
      return sum + item.price;
    }, 0);
  }

  NovaPS.orders = {
    sweep: sweep,

    // Orders of the logged-in user, newest first
    all: function () {
      sweep();
      var me = owner();
      return allOrders()
        .filter(function (o) {
          return o.owner === me;
        })
        .sort(function (a, b) {
          return b.createdAt.localeCompare(a.createdAt);
        });
    },

    get: function (id) {
      sweep();
      var me = owner();
      return (
        allOrders().filter(function (o) {
          return o.id === id && o.owner === me;
        })[0] || null
      );
    },

    // The order waiting for payment (a user may only have one at a time)
    unpaid: function () {
      return (
        NovaPS.orders.all().filter(function (o) {
          return o.status === "not_paid";
        })[0] || null
      );
    },

    // data = { customer, items: [{ unit, days }], notes }
    create: function (data) {
      sweep();
      if (NovaPS.orders.unpaid())
        throw new Error("Please finish your unpaid order first.");

      var items = data.items.map(function (item) {
        var product = PRODUCTS[item.unit];
        var days = Number(item.days);
        if (!product || !(days >= 1 && days <= NovaPS.MAX_DAYS)) {
          throw new Error("Invalid unit or rental duration.");
        }
        return { unit: item.unit, days: days, price: product.price * days };
      });
      if (!items.length || items.length > NovaPS.MAX_UNITS)
        throw new Error("Invalid number of units.");

      // Stock check: every unit in the order must be available
      var stock = stockAll();
      var need = {};
      items.forEach(function (item) {
        need[item.unit] = (need[item.unit] || 0) + 1;
      });
      Object.keys(need).forEach(function (unit) {
        if (need[unit] > stock[unit]) {
          throw new Error("Not enough " + PRODUCTS[unit].name + " in stock.");
        }
      });

      // Reserve the units right away (this is what prevents double orders)
      items.forEach(function (item) {
        adjustStock(item.unit, -1);
      });

      var now = Date.now();
      var order = {
        id: makeId(),
        owner: owner(),
        customer: data.customer,
        items: items,
        notes: data.notes || "",
        total: total(items),
        status: "not_paid",
        createdAt: new Date(now).toISOString(),
        expiresAt: now + PAY_WINDOW_MS,
      };
      var orders = allOrders();
      orders.push(order);
      write(ORDERS_KEY, orders);
      return order;
    },

    // proof = data URL of the payment proof picture
    pay: function (id, proof) {
      sweep();
      var orders = allOrders();
      var order = orders.filter(function (o) {
        return o.id === id && o.owner === owner();
      })[0];
      if (!order) throw new Error("Order not found.");
      if (order.status !== "not_paid")
        throw new Error("This order can no longer be paid.");
      order.status = "pending";
      order.paidAt = new Date().toISOString();
      order.proof = proof;
      if (!write(ORDERS_KEY, orders))
        throw new Error("Could not save the payment proof.");
      return order;
    },

    cancel: function (id, reason) {
      sweep();
      var orders = allOrders();
      var order = orders.filter(function (o) {
        return o.id === id && o.owner === owner();
      })[0];
      if (!order || order.status !== "not_paid")
        throw new Error("This order cannot be canceled.");
      cancelInPlace(order, reason, "user");
      write(ORDERS_KEY, orders);
      return order;
    },

    // Keep the orders of a user whose email was changed in My Profile
    renameOwner: function (oldEmail, newEmail) {
      var orders = allOrders();
      orders.forEach(function (o) {
        if (o.owner === (oldEmail || "").toLowerCase())
          o.owner = newEmail.toLowerCase();
      });
      write(ORDERS_KEY, orders);
    },

    msLeft: function (order) {
      return order.expiresAt - Date.now();
    },
  };

  /* ---------- formatting ---------- */

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  NovaPS.money = function (n) {
    return "Rp " + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };
  NovaPS.formatDate = function (iso) {
    var d = new Date(iso);
    return (
      pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear()
    );
  };
  NovaPS.formatTime = function (iso) {
    var d = new Date(iso);
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  };
  NovaPS.formatDays = function (n) {
    return n + (n === 1 ? " day" : " days");
  };
  // 299000 ms -> "4:59" (or "04:59" when padMinutes is true)
  NovaPS.formatClock = function (ms, padMinutes) {
    var secs = Math.max(0, Math.ceil(ms / 1000));
    var minutes = Math.floor(secs / 60);
    return (padMinutes ? pad(minutes) : minutes) + ":" + pad(secs % 60);
  };

  /* ---------- order summary lists ---------- */

  /*
   * data = { customer: { fullname, address }, items: [{ unit, days, price }], total }
   * header = rows shown first (Status, Date ...); headerDivider draws a line after
   * them (default: only when there is more than one unit).
   */
  NovaPS.summaryRows = function (data, header, headerDivider) {
    var rows = [];
    (header || []).forEach(function (r) {
      rows.push(r);
    });
    rows.push({ label: "Customer", value: data.customer.fullname });
    rows.push({ label: "Address", value: data.customer.address });
    if (data.extra)
      data.extra.forEach(function (r) {
        rows.push(r);
      });

    var many = data.items.length > 1;
    if (headerDivider === undefined ? many : headerDivider)
      rows.push({ divider: true });

    data.items.forEach(function (item, i) {
      if (i > 0) rows.push({ divider: true });
      var name = PRODUCTS[item.unit].name;
      rows.push({ label: many ? "Unit #" + (i + 1) : "Unit", value: name });
      rows.push({ label: "Duration", value: NovaPS.formatDays(item.days) });
      if (many) rows.push({ label: "Price", value: NovaPS.money(item.price) });
    });

    rows.push({ divider: true });
    rows.push({ label: "Total", value: NovaPS.money(data.total), total: true });
    return rows;
  };

  // Plain text only (textContent), so user input can never inject HTML
  NovaPS.renderRows = function (container, rows) {
    container.textContent = "";
    rows.forEach(function (row) {
      var el = document.createElement("div");
      if (row.divider) {
        el.className = "my-1.5 border-t border-slate-300";
      } else {
        el.className = row.total
          ? "flex justify-between gap-4 pt-1.5 font-display font-bold text-black"
          : "flex justify-between gap-4 py-0.5 text-base";
        var label = document.createElement("span");
        var value = document.createElement("span");
        label.textContent = row.label;
        value.textContent = row.value;
        value.className = "text-right break-words " + (row.valueClass || "");
        el.appendChild(label);
        el.appendChild(value);
      }
      container.appendChild(el);
    });
  };
})();
