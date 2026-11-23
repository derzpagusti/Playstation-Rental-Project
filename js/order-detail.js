/*
 * Order Detail / receipt page (?order=<id>).
 * Requires js/shared/session.js, orders.js and cancel-order.js.
 * Shows the receipt that matches the order status. While units are in the
 * customer's hands, every unit has its own live countdown.
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
      title: "Order Received!",
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
      text: "The unit is with you. Return it before its time runs out, or extend it.",
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
      text: "We are waiting for the admin to verify the payment. The extra time is added after that.",
    },
    complete: {
      title: "Extension Complete",
      text: "Your rental time has been extended.",
      note: "Check Time Remaining for your new deadline.",
    },
    canceled: { title: "Extension Canceled", text: "" },
    rejected: {
      title: "Extension Rejected",
      text: "The extension was rejected. Your clock continues where it stopped.",
    },
  };

  var badge = $("badge");
  var timer = null;
  var pills = []; // { el, entry, key } live countdowns of the units

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function when(iso) {
    return NovaPS.formatDate(iso) + ", " + NovaPS.formatTime(iso);
  }

  function pillClass(ms) {
    return (
      "rounded-md px-2.5 py-0.5 text-sm text-white tabular-nums " +
      NovaPS.rentalTone(ms).pill
    );
  }

  // One line per unit: name, its own countdown and its own Extend button
  function renderUnitTimers(order) {
    var box = $("unit-timers");
    box.textContent = "";
    pills = [];
    var many = order.items.length > 1;

    order.items.forEach(function (item, index) {
      var entry = NovaPS.rentals.entry(order, index);
      var name = NovaPS.PRODUCTS[item.unit].name;
      var row = el(
        "div",
        "flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2",
      );
      var left = el("div", "min-w-0 leading-tight");
      left.appendChild(
        el(
          "p",
          "text-sm font-semibold",
          name + (many ? " · Unit #" + (index + 1) : ""),
        ),
      );
      var details =
        NovaPS.formatDays(item.days) +
        (item.extraDays
          ? " + " + NovaPS.formatDays(item.extraDays) + " extended"
          : "");
      left.appendChild(el("p", "text-xs text-slate-500", details));
      row.appendChild(left);

      var right = el("div", "flex items-center gap-2");
      if (item.returnedAt) {
        right.appendChild(
          el(
            "span",
            "text-sm text-slate-900",
            "Returned " +
              NovaPS.formatDate(item.returnedAt) +
              (item.returnedLate ? " (overdue)" : ""),
          ),
        );
      } else {
        var ms = NovaPS.rentals.msLeft(entry);
        var pill = el("span", pillClass(ms), NovaPS.formatHMS(ms));
        pills.push({ el: pill, entry: entry, key: NovaPS.rentalTone(ms).key });
        right.appendChild(pill);
        if (NovaPS.rentals.pendingExtension(entry)) {
          right.appendChild(
            el("span", "text-xs text-indigo-500", "Extension waiting"),
          );
        } else if (ms > 0 && NovaPS.rentals.maxExtend(entry) > 0) {
          var extend = el(
            "a",
            "btn btn-indigo px-3 py-1 text-xs font-semibold",
            "Extend",
          );
          extend.href =
            "extend.html?order=" +
            encodeURIComponent(order.id) +
            "&unit=" +
            index;
          right.appendChild(extend);
        }
      }
      row.appendChild(right);
      box.appendChild(row);
    });
    box.hidden = false;
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
    var rental = !extension && order.status === "complete"; // units are in the customer's hands

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
    if ((rental || order.status === "returned") && order.completedAt) {
      extra.push({ label: "Delivered", value: when(order.completedAt) });
    }
    if (order.status === "returned" && order.returnedAt) {
      extra.push({
        label: "Returned",
        value:
          NovaPS.formatDate(order.returnedAt) +
          (order.returnedLate ? " (overdue)" : ""),
      });
    }
    var lateFee = extension ? 0 : NovaPS.lateFeeOf(order);
    if (lateFee)
      extra.push({
        label: "Late fee",
        value: NovaPS.money(lateFee),
        valueClass: "text-red-600",
      });
    if (order.paymentMethod === "cash") {
      extra.push({ label: "Payment", value: "Cash (Tunai)" });
    }
    if (extension) {
      extra.push({
        label: "Extended unit",
        value:
          "Unit #" + ((order.parentIndex || 0) + 1) + " of " + order.parentId,
      });
    }
    if (order.status === "canceled")
      extra.push({ label: "Reason", value: order.cancelReason });
    if (order.status === "rejected" && order.rejectReason) {
      extra.push({ label: "Reason", value: order.rejectReason });
    }
    if (order.notes) extra.push({ label: "Notes", value: order.notes });
    order.extra = extra;

    var header = [{ label: "Order ID", value: order.id }];
    if (extension) header.push({ label: "Type", value: "Extension" });
    header.push({
      label: "Status",
      value: status.label,
      valueClass: status.text,
    });
    NovaPS.renderRows($("rows"), NovaPS.summaryRows(order, header, true));

    var unpaid = order.status === "not_paid";
    $("pay-box").hidden = !unpaid;
    $("pay-box-label").textContent = "Time left to pay";
    $("act-cancel").hidden = !unpaid;
    $("act-pay").hidden = !unpaid;
    $("act-pay").href = "payment.html?order=" + encodeURIComponent(order.id);
    $("act-extend").hidden = true; // every unit has its own Extend button below
    $("act-again").hidden = order.status !== "returned" || extension;
    $("act-again").href = "order-form.html?unit=" + order.items[0].unit;

    if (rental || (!extension && order.status === "returned")) {
      renderUnitTimers(order);
    } else {
      $("unit-timers").hidden = true;
      pills = [];
    }

    clearInterval(timer);
    if (unpaid || rental) {
      tick();
      timer = setInterval(tick, 1000);
    }
  }

  // Unpaid: 5 minute countdown (flips to "Canceled"). Rental: every unit's time left.
  function tick() {
    var order = NovaPS.orders.get(id);
    if (order.status === "not_paid") {
      var countdown = $("countdown");
      countdown.textContent = NovaPS.formatClock(
        NovaPS.orders.msLeft(order),
        true,
      );
      countdown.className = "font-display text-4xl font-bold text-black";
    } else if (order.status === "complete" && order.type !== "extend") {
      var changed = false;
      pills.forEach(function (p) {
        var ms = NovaPS.rentals.msLeft(p.entry);
        p.el.textContent = NovaPS.formatHMS(ms);
        p.el.className = pillClass(ms);
        if (NovaPS.rentalTone(ms).key !== p.key) changed = true;
      });
      // a colour changed (e.g. a unit became overdue): rebuild the lines once
      if (changed) renderUnitTimers(order);
    } else {
      render();
    }
  }

  $("act-cancel").addEventListener("click", function () {
    NovaPS.askCancel(id, render); // asks for a reason, then shows the canceled receipt
  });

  render();
})();
