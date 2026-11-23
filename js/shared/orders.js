/*
 * Shared order system: units (stock, prices), orders, rentals, 5-minute
 * payment timer, extensions and late fees.
 * Requires js/shared/session.js.
 *
 * DEMO ONLY - everything lives in this browser's localStorage, so every
 * visitor has their own data. A real backend/database must own this data.
 *
 * Available units are always CALCULATED, never stored:
 *   available = total - maintenance - rented
 * where "rented" = units inside rental orders that are not_paid, pending,
 * shipped or complete and NOT returned yet. A canceled, rejected or returned
 * unit frees itself. Extension orders never hold units.
 *
 * Every unit (item) of an order has its OWN rental time once delivered:
 *   item.dueAt, item.extraDays, item.hold, item.returnedAt, item.lateFee
 * A rental "entry" = { order, index, item, key } is one unit of one order.
 *
 *   NovaPS.units.all / get / set            (admin "Unit" page)
 *   NovaPS.stock.get(unit)                  available units
 *   NovaPS.orders.create / createExtension / pay / cancel / get / all / unpaid / sweep
 *   NovaPS.orders.adminAll / adminGet / adminAct                       (admin)
 *   NovaPS.rentals.*                        per-unit time left, late fee, extension limit
 *   NovaPS.summaryRows + NovaPS.renderRows  order summary lists
 *   NovaPS.money / formatDate / formatTime / formatDays / formatClock / formatHMS
 */
(function () {
  var ORDERS_KEY = "novaps_orders";
  var UNITS_KEY = "novaps_units";
  var ALERTS_KEY = "novaps_alerts"; // "ends soon" pop-ups that were already shown
  var PAY_WINDOW_MS = 5 * 60 * 1000;
  var DAY_MS = 24 * 60 * 60 * 1000;
  var HOUR_MS = 60 * 60 * 1000;
  var FINE_PER_MIN = 1000; // late fee (Rp) per minute after a unit's time is over

  // Statuses that keep a unit busy
  var ACTIVE = ["not_paid", "pending", "shipped", "complete"];

  var BASE = {
    ps4: {
      name: "PS4",
      label: "PS 4",
      price: 50000,
      total: 10,
      maintenance: 0,
    },
    ps5: {
      name: "PS5",
      label: "PS 5",
      price: 200000,
      total: 2,
      maintenance: 0,
    },
  };

  NovaPS.MAX_DAYS = 7; // one order
  NovaPS.MAX_TOTAL_DAYS = 7; // rental + extensions together (per unit)
  NovaPS.MAX_UNITS = 2;
  NovaPS.LOW_STOCK = 3;
  NovaPS.FINE_PER_MIN = FINE_PER_MIN;
  NovaPS.HOUR_MS = HOUR_MS;

  // Order statuses as customers see them
  NovaPS.STATUS = {
    not_paid: { label: "Not Paid", text: "text-amber-600" },
    pending: { label: "Pending", text: "text-indigo-500" },
    shipped: { label: "Shipped", text: "text-sky-600" },
    complete: { label: "Complete", text: "text-green-600" },
    returned: { label: "Complete", text: "text-green-600" }, // all units returned
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

  function allOrders() {
    return read(ORDERS_KEY, []);
  }

  /* ---------- units: prices + stock ---------- */

  function savedUnits() {
    var saved = read(UNITS_KEY, {});
    var all = {};
    Object.keys(BASE).forEach(function (unit) {
      all[unit] = Object.assign({}, BASE[unit], saved[unit] || {});
    });
    return all;
  }

  function rentedCount(unit) {
    var count = 0;
    allOrders().forEach(function (order) {
      if (order.type === "extend" || ACTIVE.indexOf(order.status) === -1)
        return;
      order.items.forEach(function (item) {
        if (item.unit === unit && !item.returnedAt) count++; // a returned unit is free again
      });
    });
    return count;
  }

  function unitInfo(unit) {
    var data = savedUnits()[unit];
    var rented = rentedCount(unit);
    return {
      name: data.name,
      label: data.label,
      price: data.price,
      total: data.total,
      maintenance: data.maintenance,
      rented: rented,
      available: Math.max(0, data.total - data.maintenance - rented),
    };
  }

  // PRODUCTS[unit].price always follows the price set by the admin
  var PRODUCTS = {};
  Object.keys(BASE).forEach(function (unit) {
    Object.defineProperty(PRODUCTS, unit, {
      enumerable: true,
      get: function () {
        return {
          name: BASE[unit].name,
          label: BASE[unit].label,
          price: savedUnits()[unit].price,
        };
      },
    });
  });
  NovaPS.PRODUCTS = PRODUCTS;

  NovaPS.units = {
    all: function () {
      NovaPS.orders.sweep();
      var all = {};
      Object.keys(BASE).forEach(function (unit) {
        all[unit] = unitInfo(unit);
      });
      return all;
    },
    get: function (unit) {
      NovaPS.orders.sweep();
      return unitInfo(unit);
    },
    // patch = { price, total, maintenance } (admin). Throws a readable error.
    set: function (unit, patch) {
      if (!BASE[unit]) throw new Error("Unknown unit.");
      var next = {
        price: Number(patch.price),
        total: Number(patch.total),
        maintenance: Number(patch.maintenance),
      };
      Object.keys(next).forEach(function (key) {
        if (!Number.isInteger(next[key]) || next[key] < 0) {
          throw new Error("Please enter whole numbers (0 or more).");
        }
      });
      if (next.price < 1000)
        throw new Error("The price per day must be at least Rp 1.000.");
      if (next.total > 999) throw new Error("The total unit is too large.");
      if (next.maintenance > next.total) {
        throw new Error("Maintenance cannot be more than the total unit.");
      }
      NovaPS.orders.sweep();
      var rented = rentedCount(unit);
      if (next.total - next.maintenance < rented) {
        throw new Error(
          rented +
            " unit(s) are rented right now. Total minus maintenance cannot be lower than that.",
        );
      }
      var saved = read(UNITS_KEY, {});
      saved[unit] = next;
      write(UNITS_KEY, saved);
      return unitInfo(unit);
    },
  };

  NovaPS.stock = {
    get: function (unit) {
      return NovaPS.units.get(unit).available;
    },
  };

  /* ---------- rental time of ONE unit: due date, late fee ---------- */

  // When this unit must be back. Older orders only have one deadline for the
  // whole order, so it is rebuilt from the delivery date and the unit's days.
  function itemDue(order, index) {
    var item = order.items[index];
    if (item.dueAt) return item.dueAt;
    if (order.dueAt && order.items.length === 1) return order.dueAt;
    var start = Date.parse(order.completedAt || order.createdAt);
    return start + (item.days + (order.extraDays || 0)) * DAY_MS;
  }

  // While a paid extension waits for the admin, this unit's clock stands still
  // (item.hold.at): the time left and the late fee stop changing.
  function itemNow(item) {
    var now = Date.now();
    return item.hold ? Math.min(now, item.hold.at) : now;
  }

  function itemLeft(order, index) {
    return itemDue(order, index) - itemNow(order.items[index]);
  }

  function itemLateMinutes(order, index) {
    var late = itemNow(order.items[index]) - itemDue(order, index);
    return late > 0 ? Math.ceil(late / 60000) : 0; // every started minute counts
  }

  function clearAlerts(key) {
    var seen = read(ALERTS_KEY, {});
    delete seen[key];
    write(ALERTS_KEY, seen);
  }

  /* ---------- orders ---------- */

  // Cancel an order that is still "not_paid" (its units are free again,
  // because "canceled" is not an active status)
  function cancelInPlace(order, reason, type) {
    order.status = "canceled";
    order.canceledAt = new Date().toISOString();
    order.cancelReason = reason;
    order.cancelType = type; // "user" or "expired"
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

  function makeId(prefix) {
    var d = new Date();
    var pad2 = function (n) {
      return String(n).padStart(2, "0");
    };
    var rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return (
      (prefix || "NV") +
      "-" +
      d.getFullYear() +
      pad2(d.getMonth() + 1) +
      pad2(d.getDate()) +
      "-" +
      rand
    );
  }

  function total(items) {
    return items.reduce(function (sum, item) {
      return sum + item.price;
    }, 0);
  }

  function newestFirst(list) {
    return list.sort(function (a, b) {
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  function findMine(orders, id) {
    return orders.filter(function (o) {
      return o.id === id && o.owner === owner();
    })[0];
  }

  // The order that stops the customer from placing a new one:
  //  - QRIS: an unpaid (not_paid) order must be paid first
  //  - Cash: the order is only "done" once it becomes complete
  // Returns { order, message } or null when a new order is allowed.
  function blocker() {
    var mine = NovaPS.orders.all();
    for (var i = 0; i < mine.length; i++) {
      var o = mine[i];
      if (o.status === "not_paid") {
        return {
          order: o,
          message: "Please finish your unpaid order first.",
        };
      }
      if (
        o.paymentMethod === "cash" &&
        (o.status === "pending" || o.status === "shipped")
      ) {
        return {
          order: o,
          message:
            "Your cash order is still " +
            (o.status === "pending" ? "waiting for admin verification" : "on its way") +
            ". You can order again once it is complete.",
        };
      }
    }
    return null;
  }

  function guardCustomer() {
    if (NovaPS.users.isBlocked(owner())) {
      throw new Error(
        "Your account has been blocked. Please contact the admin.",
      );
    }
    var blocked = blocker();
    if (blocked) throw new Error(blocked.message);
  }

  function entryOf(order, index) {
    return {
      order: order,
      index: index,
      item: order.items[index],
      key: order.id + ":" + index,
    };
  }

  NovaPS.orders = {
    sweep: sweep,
    blocker: blocker,

    // Orders of the logged-in user, newest first (rentals and extensions)
    all: function () {
      sweep();
      var me = owner();
      return newestFirst(
        allOrders().filter(function (o) {
          return o.owner === me;
        }),
      );
    },

    get: function (id) {
      sweep();
      return findMine(allOrders(), id) || null;
    },

    // The order waiting for payment (a user may only have one at a time)
    unpaid: function () {
      return (
        NovaPS.orders.all().filter(function (o) {
          return o.status === "not_paid";
        })[0] || null
      );
    },

    // data = { customer, items: [{ unit, days }], notes, paymentMethod: "qris"|"cash" }
    create: function (data) {
      sweep();
      guardCustomer();
      if (NovaPS.rentals.overdue().length) {
        throw new Error(
          "You have an overdue rental. Return the unit or extend it first.",
        );
      }

      var method = data.paymentMethod === "cash" ? "cash" : "qris";

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
      var need = {};
      items.forEach(function (item) {
        need[item.unit] = (need[item.unit] || 0) + 1;
      });
      Object.keys(need).forEach(function (unit) {
        if (need[unit] > unitInfo(unit).available) {
          throw new Error("Not enough " + BASE[unit].name + " in stock.");
        }
      });

      // The new order itself reserves the units (they count as "rented")
      var now = Date.now();
      var order = {
        id: makeId(),
        owner: owner(),
        customer: data.customer,
        items: items,
        notes: data.notes || "",
        total: total(items),
        paymentMethod: method,
        // Cash: paid on the spot, so the order is pending right away
        // (no "not_paid" step, no 5 minute timer). QRIS: waits for payment.
        status: method === "cash" ? "pending" : "not_paid",
        createdAt: new Date(now).toISOString(),
      };
      if (method === "cash") {
        order.paidAt = new Date(now).toISOString(); // paid in cash at checkout
      } else {
        order.expiresAt = now + PAY_WINDOW_MS;
      }
      var orders = allOrders();
      orders.push(order);
      write(ORDERS_KEY, orders);
      return order;
    },

    // Extend ONE unit of a rental that is in the customer's hands.
    // The late fee (if that unit is overdue) is added to the price.
    createExtension: function (parentId, index, days) {
      sweep();
      guardCustomer();

      var parent = findMine(allOrders(), parentId);
      index = Number(index) || 0;
      if (
        !parent ||
        parent.type === "extend" ||
        parent.status !== "complete" ||
        !parent.items[index]
      ) {
        throw new Error("This rental cannot be extended.");
      }
      var entry = entryOf(parent, index);
      if (entry.item.returnedAt)
        throw new Error("This unit was already returned.");
      if (NovaPS.rentals.pendingExtension(entry)) {
        throw new Error(
          "Your previous extension is still waiting for admin verification.",
        );
      }
      var max = NovaPS.rentals.maxExtend(entry);
      days = Number(days);
      if (!Number.isInteger(days) || days < 1 || days > max) {
        throw new Error(
          max < 1
            ? "This unit already has the maximum of " +
                NovaPS.MAX_TOTAL_DAYS +
                " days."
            : "Choose 1 to " +
                max +
                " day(s). A rental is limited to " +
                NovaPS.MAX_TOTAL_DAYS +
                " days in total.",
        );
      }

      var items = [
        {
          unit: entry.item.unit,
          days: days,
          price: PRODUCTS[entry.item.unit].price * days,
        },
      ];
      var fine = NovaPS.rentals.fine(entry);
      var now = Date.now();
      var order = {
        id: makeId("EX"),
        owner: owner(),
        type: "extend",
        parentId: parent.id,
        parentIndex: index,
        customer: parent.customer,
        items: items,
        notes: "",
        fine: fine,
        fineMinutes: NovaPS.rentals.fineMinutes(entry),
        total: total(items) + fine,
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
      var order = findMine(orders, id);
      if (!order) throw new Error("Order not found.");
      if (order.status !== "not_paid")
        throw new Error("This order can no longer be paid.");

      if (order.type === "extend") {
        var host = orders.filter(function (o) {
          return o.id === order.parentId;
        })[0];
        var index = order.parentIndex || 0;
        var item = host && host.items[index];
        if (!host || host.status !== "complete" || !item || item.returnedAt) {
          throw new Error(
            "This unit was already returned, so it cannot be extended.",
          );
        }
        if (item.hold)
          throw new Error(
            "Another extension is already waiting for verification.",
          );
        // The extra time is added only when the admin accepts the extension.
        // Until then this unit's clock stands still once its time is over, so
        // the late fee stops growing while the customer waits.
        var stopAt =
          order.fine > 0
            ? Date.parse(order.createdAt) // the fine is already paid up to checkout
            : Math.max(itemDue(host, index), Date.now());
        item.hold = { extId: order.id, at: stopAt };
      }

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
      var order = findMine(orders, id);
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

    /* ----- admin (the real admin check must live on the server) ----- */

    adminAll: function () {
      sweep();
      return newestFirst(allOrders());
    },

    adminGet: function (id) {
      sweep();
      return (
        allOrders().filter(function (o) {
          return o.id === id;
        })[0] || null
      );
    },

    /*
     * rental:     pending --accept--> shipped --deliver--> complete
     *             complete --return (one unit at a time)--> returned (when all are back)
     * extension:  pending --accept--> complete (nothing is shipped)
     * both:       pending --reject--> rejected (reason required)
     * Rejecting an extension takes nothing away: the unit's clock only resumes.
     * index = which unit to return (only for "return").
     */
    adminAct: function (id, action, reason, index) {
      sweep();
      var orders = allOrders();
      var order = orders.filter(function (o) {
        return o.id === id;
      })[0];
      if (!order) throw new Error("Order not found.");

      var now = new Date().toISOString();
      var isExtension = order.type === "extend";
      var allowed = isExtension
        ? { accept: "pending", reject: "pending" }
        : {
            accept: "pending",
            reject: "pending",
            deliver: "shipped",
            return: "complete",
          };
      var from = allowed[action];
      if (!from) throw new Error("This action does not apply to this order.");
      if (order.status !== from)
        throw new Error("This order is no longer " + from + ".");

      var host = isExtension
        ? orders.filter(function (o) {
            return o.id === order.parentId;
          })[0]
        : null;
      var hostIndex = isExtension ? order.parentIndex || 0 : 0;
      var hostItem = host && host.items[hostIndex];

      if (action === "accept") {
        if (isExtension) {
          if (
            !host ||
            host.status !== "complete" ||
            !hostItem ||
            hostItem.returnedAt
          ) {
            throw new Error(
              "This unit was already returned. Reject the extension instead.",
            );
          }
          // The new time starts now. If the old time had run out (overdue),
          // the negative time is replaced by the new rental time.
          var start = Math.max(itemDue(host, hostIndex), Date.now());
          hostItem.dueAt = start + order.items[0].days * DAY_MS;
          hostItem.extraDays = (hostItem.extraDays || 0) + order.items[0].days;
          delete hostItem.hold;
          clearAlerts(host.id + ":" + hostIndex);
          order.status = "complete";
          order.completedAt = now;
        } else {
          order.status = "shipped";
          order.shippedAt = now;
        }
      } else if (action === "reject") {
        if (!reason || reason.trim().length < 5) {
          throw new Error("Please write the reason (at least 5 characters).");
        }
        order.status = "rejected";
        order.rejectedAt = now;
        order.rejectReason = reason.trim();
        if (isExtension && hostItem && hostItem.hold) {
          // The clock continues where it stopped: the waiting time is not counted
          hostItem.dueAt =
            itemDue(host, hostIndex) +
            Math.max(0, Date.now() - hostItem.hold.at);
          delete hostItem.hold;
          clearAlerts(host.id + ":" + hostIndex);
        }
      } else if (action === "deliver") {
        order.status = "complete";
        order.completedAt = now;
        // Every unit starts its own rental time now
        order.items.forEach(function (item) {
          item.dueAt = Date.now() + item.days * DAY_MS;
        });
      } else {
        // return ONE unit
        index =
          index === undefined && order.items.length === 1 ? 0 : Number(index);
        var unit = order.items[index];
        if (!unit) throw new Error("Choose which unit was returned.");
        if (unit.returnedAt) throw new Error("This unit was already returned.");
        if (unit.hold) {
          throw new Error(
            "This unit has an extension waiting for verification. Accept or reject it first.",
          );
        }
        var late = itemLateMinutes(order, index);
        unit.returnedAt = now;
        unit.returnedLate = late > 0;
        unit.lateMinutes = late;
        unit.lateFee = late * FINE_PER_MIN; // to be collected from the customer
        var allBack = order.items.every(function (i) {
          return !!i.returnedAt;
        });
        if (allBack) {
          order.status = "returned";
          order.returnedAt = now;
          order.returnedLate = order.items.some(function (i) {
            return i.returnedLate;
          });
        }
      }
      write(ORDERS_KEY, orders);
      return order;
    },
  };

  // Late fees already recorded for an order (one value per returned unit)
  NovaPS.lateFeeOf = function (order) {
    var sum = 0;
    var any = false;
    order.items.forEach(function (item) {
      if (item.lateFee !== undefined) {
        any = true;
        sum += item.lateFee;
      }
    });
    return any ? sum : order.lateFee || 0;
  };

  /* ---------- rentals: one entry per unit that is (or was) in a customer's hands ---------- */

  function entriesOf(orders, wantReturned) {
    var list = [];
    orders.forEach(function (order) {
      if (
        order.type === "extend" ||
        (order.status !== "complete" && order.status !== "returned")
      )
        return;
      order.items.forEach(function (item, index) {
        var isBack = !!item.returnedAt || order.status === "returned";
        if (isBack === wantReturned) list.push(entryOf(order, index));
      });
    });
    return list;
  }

  function byDue(a, b) {
    return NovaPS.rentals.dueAt(a) - NovaPS.rentals.dueAt(b);
  }

  NovaPS.rentals = {
    // Every function below takes an entry: { order, index, item, key }
    entry: entryOf,
    dueAt: function (e) {
      return itemDue(e.order, e.index);
    },
    msLeft: function (e) {
      return itemLeft(e.order, e.index);
    },
    fineMinutes: function (e) {
      return itemLateMinutes(e.order, e.index);
    },
    fine: function (e) {
      return itemLateMinutes(e.order, e.index) * FINE_PER_MIN;
    },
    totalDays: function (e) {
      return e.item.days + (e.item.extraDays || 0);
    },
    // How many more days may still be added (a unit is rented 7 days at most)
    maxExtend: function (e) {
      return Math.max(0, NovaPS.MAX_TOTAL_DAYS - NovaPS.rentals.totalDays(e));
    },
    // A paid extension that the admin has not verified yet (or null)
    pendingExtension: function (e) {
      return (
        allOrders().filter(function (o) {
          return (
            o.type === "extend" &&
            o.parentId === e.order.id &&
            (o.parentIndex || 0) === e.index &&
            o.status === "pending"
          );
        })[0] || null
      );
    },
    // The logged-in user's units that are not returned yet, most urgent first
    mine: function () {
      return entriesOf(NovaPS.orders.all(), false).sort(byDue);
    },
    // Their returned units, newest first
    returned: function () {
      return entriesOf(NovaPS.orders.all(), true).sort(function (a, b) {
        var bt = b.item.returnedAt || b.order.returnedAt || "";
        var at = a.item.returnedAt || a.order.returnedAt || "";
        return bt.localeCompare(at);
      });
    },
    overdue: function () {
      return NovaPS.rentals.mine().filter(function (e) {
        return NovaPS.rentals.msLeft(e) <= 0;
      });
    },
    // Admin: every unit that is out with a customer, most urgent first
    adminActive: function () {
      return entriesOf(NovaPS.orders.adminAll(), false).sort(byDue);
    },
  };

  // Countdown colour: green > 4 h, amber <= 4 h, orange <= 1 h, red = overdue
  NovaPS.rentalTone = function (ms) {
    if (ms <= 0)
      return { key: "over", pill: "bg-red-800", text: "text-red-800" };
    if (ms <= HOUR_MS)
      return { key: "h1", pill: "bg-orange-700", text: "text-orange-700" };
    if (ms <= 4 * HOUR_MS)
      return { key: "h4", pill: "bg-amber-600", text: "text-amber-600" };
    return { key: "ok", pill: "bg-green-600", text: "text-green-600" };
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
  // 259200000 -> "72:00:00"; negative (overdue) -> "-2:00:00"
  NovaPS.formatHMS = function (ms) {
    var secs = ms < 0 ? Math.floor(-ms / 1000) : Math.ceil(ms / 1000);
    var h = Math.floor(secs / 3600);
    return (
      (ms < 0 ? "-" : "") +
      h +
      ":" +
      pad(Math.floor((secs % 3600) / 60)) +
      ":" +
      pad(secs % 60)
    );
  };

  /* ---------- order summary lists ---------- */

  /*
   * data = { customer: { fullname, address }, items: [{ unit, days, price }], total }
   * header = rows shown first (Status, Order ID ...); data.extra = rows after Address
   * (Date ...). headerDivider draws a line after them (default: only with 2+ units).
   * Extension orders (data.type "extend") show "(Extend)" and the late fee.
   */
  NovaPS.summaryRows = function (data, header, headerDivider) {
    var rows = [];
    (header || []).forEach(function (r) {
      rows.push(r);
    });
    rows.push({ label: "Customer", value: data.customer.fullname });
    rows.push({ label: "Address", value: data.customer.address });
    if (data.extra) {
      data.extra.forEach(function (r) {
        rows.push(r);
      });
    }

    var many = data.items.length > 1;
    var extension = data.type === "extend";
    if (headerDivider === undefined ? many : headerDivider)
      rows.push({ divider: true });

    data.items.forEach(function (item, i) {
      if (i > 0) rows.push({ divider: true });
      var name = BASE[item.unit].name + (extension ? " (Extend)" : "");
      rows.push({ label: many ? "Unit #" + (i + 1) : "Unit", value: name });
      rows.push({ label: "Duration", value: NovaPS.formatDays(item.days) });
      if (many || extension)
        rows.push({ label: "Price", value: NovaPS.money(item.price) });
    });

    if (data.fine) {
      rows.push({ divider: true });
      rows.push({
        label: "Late fee (" + data.fineMinutes + " min)",
        value: NovaPS.money(data.fine),
        valueClass: "text-red-600",
      });
    }

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
