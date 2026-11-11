/*
 * Time Remaining page: live countdown for every unit in the customer's hands.
 * Requires js/shared/session.js, tabs.js and orders.js.
 *
 * The countdown starts when the admin confirms the unit was delivered
 * (status "complete"). Colours: green > 4 h, amber <= 4 h, orange <= 1 h,
 * red = overdue (late fee Rp 1.000 per minute).
 */
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  var list = $("rental-list");
  var emptyState = $("empty-state");
  var message = $("empty-message");
  var cta = $("empty-cta");
  var current = "all";
  var timers = []; // { el, order, key } for the cards that have a countdown

  var messages = {
    "4-hours": "No rentals ending within 4 hours.",
    "1-hour": "No rentals ending within 1 hour.",
    overdue: "No overdue rentals.",
    returned: "No returned rentals yet.",
  };

  var BTN = "btn px-3 py-1 text-sm font-medium";
  var BTN_OUTLINE =
    BTN +
    " border-slate-800 bg-white text-slate-800 hover:bg-slate-800 hover:text-white";
  var BTN_INDIGO = BTN + " btn-indigo";

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text; // plain text only
    return node;
  }

  function link(label, href, className) {
    var a = el("a", className, label);
    a.href = href;
    return a;
  }

  function pillClass(ms) {
    return (
      "rounded-md px-2.5 py-0.5 text-[15px] text-white tabular-nums " +
      NovaPS.rentalTone(ms).pill
    );
  }

  function card(order) {
    var li = el("li", "rounded-lg border border-slate-200 bg-white p-6");
    var returned = order.status === "returned";
    var left = NovaPS.rentals.msLeft(order);

    var names = order.items.map(function (i) {
      return NovaPS.PRODUCTS[i.unit].name;
    });
    var units = order.items.map(function (i) {
      return (
        NovaPS.PRODUCTS[i.unit].name + " (" + NovaPS.formatDays(i.days) + ")"
      );
    });
    var extended = order.extraDays
      ? " + " + NovaPS.formatDays(order.extraDays) + " extended"
      : "";

    var top = el(
      "div",
      "flex flex-wrap items-start justify-between gap-x-4 gap-y-1",
    );
    var info = el("div", "min-w-0");
    info.appendChild(el("p", "font-semibold text-black", names.join(" + ")));
    info.appendChild(
      el(
        "p",
        "text-[13px] break-words text-slate-500",
        units.join(", ") + extended + " · " + order.customer.address,
      ),
    );
    info.appendChild(
      el(
        "p",
        "text-[13px] text-slate-500",
        returned
          ? "Returned " + NovaPS.formatDate(order.returnedAt)
          : "Return before " +
              NovaPS.formatDate(
                new Date(NovaPS.rentals.dueAt(order)).toISOString(),
              ) +
              ", " +
              NovaPS.formatTime(
                new Date(NovaPS.rentals.dueAt(order)).toISOString(),
              ),
      ),
    );
    info.appendChild(
      el(
        "p",
        "text-[13px] text-slate-500",
        "Total " + NovaPS.money(order.total),
      ),
    );

    var waiting = !returned && NovaPS.rentals.pendingExtension(order);
    var right = el("p", "text-[15px]");
    if (returned) {
      right.appendChild(el("span", "text-black", "Returned"));
      if (order.returnedLate)
        right.appendChild(el("span", "text-red-600", " (Overdue)"));
    } else {
      var pill = el("span", pillClass(left), NovaPS.formatHMS(left));
      right.appendChild(pill);
      timers.push({ el: pill, order: order, key: NovaPS.rentalTone(left).key });
    }
    if (waiting) {
      right.appendChild(
        el(
          "span",
          "mt-1 block text-right text-xs text-indigo-500",
          "Extension waiting for verification",
        ),
      );
    }
    top.appendChild(info);
    top.appendChild(right);

    var actions = el("div", "mt-3 flex flex-wrap justify-end gap-2");
    actions.appendChild(
      link(
        "Look Detail",
        "order-detail.html?order=" + encodeURIComponent(order.id),
        BTN_OUTLINE,
      ),
    );
    if (
      !returned &&
      !waiting &&
      left > 0 &&
      NovaPS.rentals.maxExtend(order) > 0
    ) {
      actions.appendChild(
        link(
          "Extend",
          "extend.html?order=" + encodeURIComponent(order.id),
          BTN_INDIGO,
        ),
      );
    }
    if (returned) {
      actions.appendChild(
        link(
          "Order Again",
          "order-form.html?unit=" + order.items[0].unit,
          BTN_INDIGO,
        ),
      );
    }

    li.appendChild(top);
    li.appendChild(actions);
    return li;
  }

  function visible(orders) {
    var active = orders
      .filter(function (o) {
        return o.status === "complete";
      })
      .sort(function (a, b) {
        return NovaPS.rentals.dueAt(a) - NovaPS.rentals.dueAt(b); // most urgent first
      });
    var returned = orders.filter(function (o) {
      return o.status === "returned";
    });

    function leftOf(o) {
      return NovaPS.rentals.msLeft(o);
    }
    if (current === "4-hours") {
      return active.filter(function (o) {
        return leftOf(o) > 0 && leftOf(o) <= 4 * NovaPS.HOUR_MS;
      });
    }
    if (current === "1-hour") {
      return active.filter(function (o) {
        return leftOf(o) > 0 && leftOf(o) <= NovaPS.HOUR_MS;
      });
    }
    if (current === "overdue") {
      return active.filter(function (o) {
        return leftOf(o) <= 0;
      });
    }
    if (current === "returned") return returned;
    return active.concat(returned);
  }

  function render() {
    var rentals = NovaPS.orders.all().filter(function (o) {
      return o.type !== "extend";
    });
    var shown = visible(rentals);

    list.textContent = "";
    timers = [];
    shown.forEach(function (order) {
      list.appendChild(card(order));
    });

    emptyState.hidden = shown.length > 0;
    if (current === "all") {
      var hasOrders = rentals.length > 0;
      message.textContent = hasOrders
        ? "No rental in progress. The countdown starts when your unit is delivered."
        : "You haven’t ordered anything yet";
      cta.textContent = hasOrders ? "Order Status" : "Order Now";
      cta.href = hasOrders ? "order-status.html" : "order-form.html";
      cta.hidden = false;
    } else {
      message.textContent = messages[current];
      cta.hidden = true;
    }
  }

  function tick() {
    var changed = false;
    timers.forEach(function (t) {
      var left = NovaPS.rentals.msLeft(t.order);
      t.el.textContent = NovaPS.formatHMS(left);
      t.el.className = pillClass(left);
      if (NovaPS.rentalTone(left).key !== t.key) changed = true; // card moves to another tab
    });
    if (changed) render();
  }

  NovaPS.initTabs($("tabs"), function (key) {
    current = key;
    render();
  });

  render();
  setInterval(tick, 1000);
  window.addEventListener("storage", render);
})();
