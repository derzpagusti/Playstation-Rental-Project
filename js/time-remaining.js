/*
 * Time Remaining page: a live countdown for EVERY UNIT in the customer's
 * hands (a 2-unit order with 3 and 2 days shows two separate countdowns).
 * Requires js/shared/session.js, tabs.js and orders.js.
 *
 * The countdown starts when the admin confirms the unit was delivered.
 * Colours: green > 4 h, amber <= 4 h, orange <= 1 h, red = overdue
 * (late fee Rp 1.000 per minute).
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
  var timers = []; // { el, entry, key } for the cards that have a countdown

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

  function when(ms) {
    var iso = new Date(ms).toISOString();
    return NovaPS.formatDate(iso) + ", " + NovaPS.formatTime(iso);
  }

  function card(entry, returned) {
    var order = entry.order;
    var item = entry.item;
    var name = NovaPS.PRODUCTS[item.unit].name;
    var many = order.items.length > 1;
    var li = el("li", "rounded-lg border border-slate-200 bg-white p-6");
    var left = NovaPS.rentals.msLeft(entry);
    var waiting = !returned && NovaPS.rentals.pendingExtension(entry);
    var extended = item.extraDays
      ? " + " + NovaPS.formatDays(item.extraDays) + " extended"
      : "";

    var top = el(
      "div",
      "flex flex-wrap items-start justify-between gap-x-4 gap-y-1",
    );
    var info = el("div", "min-w-0");
    info.appendChild(
      el(
        "p",
        "font-semibold text-black",
        name + (many ? " · Unit #" + (entry.index + 1) : ""),
      ),
    );
    info.appendChild(
      el(
        "p",
        "text-[13px] break-words text-slate-500",
        name +
          " (" +
          NovaPS.formatDays(item.days) +
          ")" +
          extended +
          " · " +
          order.customer.address,
      ),
    );
    info.appendChild(
      el(
        "p",
        "text-[13px] text-slate-500",
        returned
          ? "Returned " + NovaPS.formatDate(item.returnedAt || order.returnedAt)
          : "Return before " + when(NovaPS.rentals.dueAt(entry)),
      ),
    );
    info.appendChild(
      el(
        "p",
        "text-[13px] text-slate-500",
        "Total " + NovaPS.money(item.price) + " · Order " + order.id,
      ),
    );

    var right = el("p", "text-[15px]");
    if (returned) {
      right.appendChild(el("span", "text-black", "Returned"));
      if (item.returnedLate || (!item.returnedAt && order.returnedLate)) {
        right.appendChild(el("span", "text-red-600", " (Overdue)"));
      }
    } else {
      var pill = el("span", pillClass(left), NovaPS.formatHMS(left));
      right.appendChild(pill);
      timers.push({ el: pill, entry: entry, key: NovaPS.rentalTone(left).key });
      if (waiting) {
        right.appendChild(
          el(
            "span",
            "mt-1 block text-right text-xs text-indigo-500",
            "Extension waiting for verification",
          ),
        );
      }
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
      NovaPS.rentals.maxExtend(entry) > 0
    ) {
      actions.appendChild(
        link(
          "Extend",
          "extend.html?order=" +
            encodeURIComponent(order.id) +
            "&unit=" +
            entry.index,
          BTN_INDIGO,
        ),
      );
    }
    if (returned) {
      actions.appendChild(
        link("Order Again", "order-form.html?unit=" + item.unit, BTN_INDIGO),
      );
    }

    li.appendChild(top);
    li.appendChild(actions);
    return li;
  }

  function visible() {
    var active = NovaPS.rentals.mine(); // most urgent first
    var returned = NovaPS.rentals.returned();
    function leftOf(e) {
      return NovaPS.rentals.msLeft(e);
    }
    if (current === "4-hours") {
      return {
        cards: active.filter(function (e) {
          return leftOf(e) > 0 && leftOf(e) <= 4 * NovaPS.HOUR_MS;
        }),
        returned: [],
      };
    }
    if (current === "1-hour") {
      return {
        cards: active.filter(function (e) {
          return leftOf(e) > 0 && leftOf(e) <= NovaPS.HOUR_MS;
        }),
        returned: [],
      };
    }
    if (current === "overdue") {
      return {
        cards: active.filter(function (e) {
          return leftOf(e) <= 0;
        }),
        returned: [],
      };
    }
    if (current === "returned") return { cards: [], returned: returned };
    return { cards: active, returned: returned };
  }

  function render() {
    var shown = visible();

    list.textContent = "";
    timers = [];
    shown.cards.forEach(function (entry) {
      list.appendChild(card(entry, false));
    });
    shown.returned.forEach(function (entry) {
      list.appendChild(card(entry, true));
    });

    var count = shown.cards.length + shown.returned.length;
    emptyState.hidden = count > 0;
    if (current === "all") {
      var hasOrders = NovaPS.orders.all().some(function (o) {
        return o.type !== "extend";
      });
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
      var left = NovaPS.rentals.msLeft(t.entry);
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
