/*
 * Order Status page: order history (newest first) with status tabs.
 * Requires js/shared/session.js, tabs.js and orders.js.
 */
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  var list = $("order-list");
  var emptyState = $("empty-state");
  var message = $("empty-message");
  var cta = $("empty-cta");
  var current = "all";
  var countdowns = []; // { el, order } for the "Not Paid" cards

  var messages = {
    all: "You haven’t ordered anything yet",
    "not-paid": "No unpaid orders.",
    pending: "No pending orders.",
    shipped: "No shipped orders.",
    complete: "No completed orders yet.",
    canceled: "No canceled orders.",
    rejected: "No rejected orders.",
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

  function card(order) {
    var li = el("li", "rounded-lg border border-slate-200 bg-white p-6");
    var status = NovaPS.STATUS[order.status];
    var detail = "order-detail.html?order=" + encodeURIComponent(order.id);

    var top = el(
      "div",
      "flex flex-wrap items-start justify-between gap-x-4 gap-y-1",
    );
    var info = el("div", "min-w-0");
    var names = order.items.map(function (i) {
      return NovaPS.PRODUCTS[i.unit].name;
    });
    var units = order.items.map(function (i) {
      return (
        NovaPS.PRODUCTS[i.unit].name + " (" + NovaPS.formatDays(i.days) + ")"
      );
    });
    info.appendChild(el("p", "font-semibold text-black", names.join(" + ")));
    info.appendChild(
      el(
        "p",
        "text-[13px] break-words text-slate-500",
        units.join(", ") + " · " + order.customer.address,
      ),
    );
    info.appendChild(
      el(
        "p",
        "text-[13px] text-slate-500",
        NovaPS.formatDate(order.createdAt) +
          ", " +
          NovaPS.formatTime(order.createdAt),
      ),
    );
    info.appendChild(
      el(
        "p",
        "text-[13px] text-slate-500",
        "Total " + NovaPS.money(order.total),
      ),
    );

    var right = el("p", "flex items-center gap-3 text-[15px]");
    if (order.status === "not_paid") {
      var clock = el("span", "text-black tabular-nums");
      right.appendChild(clock);
      countdowns.push({ el: clock, order: order });
    }
    right.appendChild(el("span", status.text, status.label));

    top.appendChild(info);
    top.appendChild(right);

    var actions = el("div", "mt-3 flex flex-wrap justify-end gap-2");
    actions.appendChild(link("Look Detail", detail, BTN_OUTLINE));
    if (order.status === "not_paid") {
      actions.appendChild(
        link(
          "Pay Now",
          "payment.html?order=" + encodeURIComponent(order.id),
          BTN_INDIGO,
        ),
      );
    }
    if (order.status === "complete") {
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

  function updateCountdowns() {
    var expired = false;
    countdowns.forEach(function (c) {
      var left = NovaPS.orders.msLeft(c.order);
      if (left <= 0) expired = true;
      else c.el.textContent = NovaPS.formatClock(left);
    });
    if (expired) render(); // the order was canceled automatically
  }

  function render() {
    var orders = NovaPS.orders.all(); // newest first
    var shown =
      current === "all"
        ? orders
        : orders.filter(function (o) {
            return o.status === current.replace("-", "_");
          });

    list.textContent = "";
    countdowns = [];
    shown.forEach(function (order) {
      list.appendChild(card(order));
    });

    emptyState.hidden = shown.length > 0;
    message.textContent = messages[current];
    cta.hidden = current !== "all"; // "Order Now" only when there are no orders at all
    updateCountdowns();
  }

  NovaPS.initTabs($("tabs"), function (key) {
    current = key;
    render();
  });

  render();
  setInterval(updateCountdowns, 1000);
})();
