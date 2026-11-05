/*
 * Order Detail / receipt page (?order=<id>).
 * Requires js/shared/session.js and orders.js.
 * Shows the receipt that matches the order status (pending, canceled, ...).
 */
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  var id = new URLSearchParams(location.search).get("order");
  if (!id || !NovaPS.orders.get(id)) {
    location.replace("order-status.html");
    return;
  }

  var GLYPHS = {
    check: '<path d="M30 52l14 14 27-30" />',
    cross: '<path d="M36 36l28 28M64 36l-28 28" />',
    clock: '<circle cx="50" cy="50" r="17" /><path d="M50 40v11l8 5" />',
  };

  // What each status looks like on the receipt
  var VIEWS = {
    not_paid: {
      tone: "text-amber-500",
      glyph: "clock",
      title: "Waiting for Payment",
      text: "Please complete your payment before the time runs out.",
      note: "",
    },
    pending: {
      tone: "text-green-500",
      glyph: "check",
      title: "Your Payment Is Complete!",
      text: "Thank you. We have received your order, and it is awaiting admin verification.",
      note: "Please check your order status to see the status of your order",
    },
    shipped: {
      tone: "text-sky-500",
      glyph: "check",
      title: "Your Order Is On Its Way",
      text: "Your order was verified and the unit is being delivered.",
      note: "Please check your order status to follow your order",
    },
    complete: {
      tone: "text-green-500",
      glyph: "check",
      title: "Order Complete",
      text: "Thank you for renting with NovaPS. Enjoy the game!",
      note: "You can order again anytime.",
    },
    canceled: {
      tone: "text-red-500",
      glyph: "cross",
      title: "Order Canceled",
      text: "",
      note: "You can place a new order anytime.",
    },
    rejected: {
      tone: "text-red-500",
      glyph: "cross",
      title: "Order Rejected",
      text: "Sorry, your order was rejected by the admin.",
      note: "Please check your order status for details.",
    },
  };

  var badge = $("badge");
  var timer = null;

  function render() {
    var order = NovaPS.orders.get(id);
    var view = VIEWS[order.status];
    var status = NovaPS.STATUS[order.status];

    badge.setAttribute(
      "class",
      "mx-auto size-[130px] transition-colors duration-300 " + view.tone,
    );
    $("glyph").innerHTML = GLYPHS[view.glyph]; // fixed strings above, never user input
    $("title").textContent = view.title;
    $("subtitle").textContent =
      order.status === "canceled"
        ? order.cancelType === "expired"
          ? "The payment time ran out, so this order was canceled automatically."
          : "You canceled this order."
        : view.text;
    $("note").textContent = view.note;
    $("note").hidden = !view.note;

    // Rows: Order ID, Status, Customer, Address, Date (+ reason / notes), units, total
    var extra = [
      {
        label: "Date",
        value:
          NovaPS.formatDate(order.createdAt) +
          ", " +
          NovaPS.formatTime(order.createdAt),
      },
    ];
    if (order.status === "canceled")
      extra.push({ label: "Reason", value: order.cancelReason });
    if (order.notes) extra.push({ label: "Notes", value: order.notes });
    order.extra = extra;

    NovaPS.renderRows(
      $("rows"),
      NovaPS.summaryRows(
        order,
        [
          { label: "Order ID", value: order.id },
          { label: "Status", value: status.label, valueClass: status.text },
        ],
        true,
      ),
    );

    var unpaid = order.status === "not_paid";
    $("pay-box").hidden = !unpaid;
    $("act-pay").hidden = !unpaid;
    $("act-pay").href = "payment.html?order=" + encodeURIComponent(order.id);
    $("act-again").hidden = order.status !== "complete";
    $("act-again").href = "order-form.html?unit=" + order.items[0].unit;

    clearInterval(timer);
    if (unpaid) {
      tick();
      timer = setInterval(tick, 1000);
    }
  }

  // Unpaid receipt: live countdown, flips to "Canceled" when time is over
  function tick() {
    var order = NovaPS.orders.get(id);
    if (order.status !== "not_paid") {
      render();
      return;
    }
    $("countdown").textContent = NovaPS.formatClock(
      NovaPS.orders.msLeft(order),
      true,
    );
  }

  render();
})();
