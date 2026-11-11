/*
 * Order Detail / receipt page (?order=<id>).
 * Requires js/shared/session.js and orders.js.
 * Shows the receipt that matches the order status (pending, canceled, ...),
 * and the live countdown while the unit is in the customer's hands.
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
      title: "Enjoy Your Rental!",
      text: "The unit is with you. Return it before the time runs out, or extend your rental.",
      note: "",
    },
    returned: {
      tone: "text-green-500",
      glyph: "check",
      title: "Unit Returned",
      text: "Thank you for renting with NovaPS. We hope to see you again!",
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

  // Extension orders have no "shipped" step and their own wording
  var EXTENSION_VIEWS = {
    not_paid: {
      title: "Waiting for Payment",
      text: "Pay before the time runs out to extend your rental.",
    },
    pending: {
      title: "Extension Payment Received",
      text: "Your extra time is already added to your rental. We are waiting for the admin to verify the payment.",
    },
    complete: {
      title: "Extension Complete",
      text: "Your rental time has been extended.",
      note: "Check Time Remaining for your new deadline.",
    },
    canceled: { title: "Extension Canceled", text: "" },
    rejected: {
      title: "Extension Rejected",
      text: "The extension was rejected, so the extra time was removed from your rental.",
    },
  };

  var badge = $("badge");
  var timer = null;

  function when(iso) {
    return NovaPS.formatDate(iso) + ", " + NovaPS.formatTime(iso);
  }

  function render() {
    var order = NovaPS.orders.get(id);
    var extension = order.type === "extend";
    var view = Object.assign(
      {},
      VIEWS[order.status],
      extension ? EXTENSION_VIEWS[order.status] : {},
    );
    var status = NovaPS.STATUS[order.status];
    var rental = !extension && order.status === "complete"; // unit is in the customer's hands

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
    $("note").textContent = view.note || "";
    $("note").hidden = !view.note;

    // Rows: Order ID, Status, Customer, Address, Date (+ dates / reason / notes), units, total
    var extra = [{ label: "Date", value: when(order.createdAt) }];
    if (rental || order.status === "returned") {
      if (order.completedAt)
        extra.push({ label: "Delivered", value: when(order.completedAt) });
      var due = new Date(NovaPS.rentals.dueAt(order)).toISOString();
      if (rental) extra.push({ label: "Return before", value: when(due) });
      if (order.extraDays)
        extra.push({
          label: "Extended",
          value: "+" + NovaPS.formatDays(order.extraDays),
        });
      if (order.returnedAt)
        extra.push({
          label: "Returned",
          value:
            NovaPS.formatDate(order.returnedAt) +
            (order.returnedLate ? " (overdue)" : ""),
        });
      if (order.lateFee)
        extra.push({
          label: "Late fee",
          value: NovaPS.money(order.lateFee),
          valueClass: "text-red-600",
        });
    }
    if (order.status === "canceled")
      extra.push({ label: "Reason", value: order.cancelReason });
    if (order.status === "rejected" && order.rejectReason) {
      extra.push({ label: "Reason", value: order.rejectReason });
    }
    var waiting = rental ? NovaPS.rentals.pendingExtension(order) : null;
    if (waiting) {
      extra.push({
        label: "Extension",
        value:
          "+" +
          NovaPS.formatDays(waiting.items[0].days) +
          ", waiting for admin verification",
        valueClass: "text-indigo-500",
      });
    }
    if (order.notes) extra.push({ label: "Notes", value: order.notes });
    order.extra = extra;

    var header = [{ label: "Order ID", value: order.id }];
    if (extension)
      header.push({ label: "Type", value: "Extension of " + order.parentId });
    header.push({
      label: "Status",
      value: status.label,
      valueClass: status.text,
    });
    NovaPS.renderRows($("rows"), NovaPS.summaryRows(order, header, true));

    var unpaid = order.status === "not_paid";
    $("pay-box").hidden = !(unpaid || rental);
    $("pay-box-label").textContent = rental
      ? "Time remaining"
      : "Time left to pay";
    $("act-cancel").hidden = !unpaid;
    $("act-pay").hidden = !unpaid;
    $("act-pay").href = "payment.html?order=" + encodeURIComponent(order.id);
    $("act-extend").hidden =
      !rental || !!waiting || NovaPS.rentals.maxExtend(order) < 1;
    $("act-extend").href = "extend.html?order=" + encodeURIComponent(order.id);
    $("act-again").hidden = order.status !== "returned" || extension;
    $("act-again").href = "order-form.html?unit=" + order.items[0].unit;

    clearInterval(timer);
    if (unpaid || rental) {
      tick();
      timer = setInterval(tick, 1000);
    }
  }

  // Unpaid: 5 minute countdown (flips to "Canceled"). Rental: time left (green -> red).
  function tick() {
    var order = NovaPS.orders.get(id);
    var countdown = $("countdown");
    if (order.status === "not_paid") {
      countdown.textContent = NovaPS.formatClock(
        NovaPS.orders.msLeft(order),
        true,
      );
      countdown.className = "font-display text-4xl font-bold text-black";
    } else if (order.status === "complete" && order.type !== "extend") {
      var left = NovaPS.rentals.msLeft(order);
      countdown.textContent = NovaPS.formatHMS(left);
      countdown.className =
        "font-display text-4xl font-bold " + NovaPS.rentalTone(left).text;
    } else {
      render();
    }
  }

  $("act-cancel").addEventListener("click", function () {
    NovaPS.askCancel(id, render); // asks for a reason, then shows the canceled receipt
  });

  render();
})();
