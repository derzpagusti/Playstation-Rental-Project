/*
 * Shared admin helpers: table cells, pop-ups, toast and the order detail
 * pop-up (used by the Dashboard and Orders pages).
 * Requires js/shared/session.js, admin.js and orders.js.
 */
window.NovaAdmin = (function () {
  // How each status is shown in the admin tables
  var STATUS = {
    not_paid: ["Not Paid", "text-amber-600"],
    pending: ["Pending", "text-indigo-500"],
    shipped: ["Shipped", "text-sky-600"],
    complete: ["Complete", "text-green-600"],
    returned: ["Returned", "text-slate-900"],
    canceled: ["Canceled", "text-orange-700"],
    rejected: ["Rejected", "text-red-600"],
  };

  var MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text; // plain text only
    return node;
  }

  function $(id) {
    return document.getElementById(id);
  }

  /* ---------- table cells ---------- */

  // Several lines inside one cell (orders with 2 units)
  function stack(lines) {
    var box = el("div", "grid");
    lines.forEach(function (line) {
      box.appendChild(el("span", "", line));
    });
    return box;
  }

  function statusCell(order) {
    var info = STATUS[order.status];
    var box = el("span", info[1], info[0]);
    if (order.status === "returned" && order.returnedLate) {
      box.appendChild(el("span", "text-red-600", " (Overdue)"));
    }
    return box;
  }

  function dateCell(iso) {
    var box = el("div", "leading-tight");
    box.appendChild(el("p", "", NovaPS.formatDate(iso)));
    box.appendChild(el("p", "text-xs text-slate-500", NovaPS.formatTime(iso)));
    return box;
  }

  // Extension orders show "(Extend)", count no new unit and show only the extra days
  function unitNames(order) {
    return order.items.map(function (i) {
      return (
        NovaPS.PRODUCTS[i.unit].name +
        (order.type === "extend" ? " (Extend)" : "")
      );
    });
  }

  function unitCounts(order) {
    return order.items.map(function () {
      return order.type === "extend" ? "-" : "1";
    });
  }

  function durationLines(order) {
    return order.items.map(function (i) {
      return (
        NovaPS.formatDays(i.days) + (order.type === "extend" ? " (Extend)" : "")
      );
    });
  }

  function cell(child, className) {
    var td = el(
      "td",
      "border-b border-slate-300 px-2 py-3 align-middle " + (className || ""),
    );
    if (typeof child === "string") td.textContent = child;
    else td.appendChild(child);
    return td;
  }

  function headRow(labels) {
    var tr = el("tr");
    labels.forEach(function (label) {
      tr.appendChild(
        el(
          "th",
          "border-b border-slate-400 px-2 pb-2 text-xs font-semibold text-slate-500",
          label,
        ),
      );
    });
    return tr;
  }

  function lookButton(onClick, label) {
    var btn = el(
      "button",
      "btn btn-mini btn-mini-blue",
      label || "Look Detail",
    );
    btn.type = "button";
    btn.addEventListener("click", onClick);
    return btn;
  }

  /* ---------- pop-ups + toast ---------- */

  function modal(root) {
    var lastFocus = null;
    var api = {
      isOpen: function () {
        return root.hasAttribute("data-open");
      },
      open: function () {
        lastFocus = document.activeElement;
        root.setAttribute("data-open", ""); // Tailwind: data-[open]:...
        root.setAttribute("aria-hidden", "false");
        document.body.classList.add("overflow-hidden");
        setTimeout(function () {
          var target =
            root.querySelector("[data-autofocus]") ||
            root.querySelector("[data-close]");
          if (target) target.focus();
        }, 50);
      },
      close: function () {
        if (!api.isOpen()) return;
        root.removeAttribute("data-open");
        root.setAttribute("aria-hidden", "true");
        document.body.classList.remove("overflow-hidden");
        if (lastFocus) lastFocus.focus();
      },
    };
    root.addEventListener("click", function (e) {
      if (e.target === root || e.target.closest("[data-close]")) api.close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") api.close();
    });
    return api;
  }

  var toastTimer = null;
  function toast(text) {
    var box = $("toast");
    if (!box) return;
    box.textContent = text;
    box.setAttribute("data-open", "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      box.removeAttribute("data-open");
    }, 3000);
  }

  /* ---------- small builders for pop-up content ---------- */

  function section(parent, title) {
    var box = el("section", "mt-4 first:mt-0");
    box.appendChild(
      el(
        "h3",
        "mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase",
        title,
      ),
    );
    parent.appendChild(box);
    return box;
  }

  function kv(parent, label, value, valueClass) {
    var row = el(
      "div",
      "flex justify-between gap-4 border-b border-slate-100 py-1.5 text-sm",
    );
    row.appendChild(el("span", "shrink-0 text-slate-500", label));
    row.appendChild(
      el("span", "text-right break-words " + (valueClass || ""), value),
    );
    parent.appendChild(row);
    return row;
  }

  // Only real pictures are shown (the data comes from user uploads)
  function picture(parent, src, alt) {
    if (!src || !/^data:image\//.test(src)) {
      parent.appendChild(
        el("p", "py-2 text-sm text-slate-400", "No picture uploaded."),
      );
      return;
    }
    var img = el(
      "img",
      "mt-1 max-h-72 w-full rounded-md border border-slate-200 bg-slate-50 object-contain",
    );
    img.src = src;
    img.alt = alt;
    parent.appendChild(img);
  }

  function whatsappLink(phone) {
    var digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return null;
    if (digits.indexOf("0") === 0) digits = "62" + digits.slice(1);
    var a = el(
      "a",
      "text-xs text-blue-600 underline underline-offset-2 hover:text-blue-700",
      "Chat on WhatsApp",
    );
    a.href = "https://wa.me/" + digits;
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  }

  /* ---------- order detail pop-up (Dashboard + Orders) ---------- */

  function orderModal(onChange) {
    var root = $("orderModal");
    var body = $("orderBody");
    var actions = $("orderActions");
    var rejectBox = $("rejectBox");
    var rejectReason = $("rejectReason");
    var rejectError = $("rejectError");
    var m = modal(root);
    var currentId = null;

    function act(action, reason, message) {
      try {
        var done = NovaPS.orders.adminAct(currentId, action, reason);
        toast(
          done.lateFee
            ? message + " Late fee to collect: " + NovaPS.money(done.lateFee)
            : message,
        );
        m.close(); // done: no need to press the X
        if (onChange) onChange();
      } catch (e) {
        toast(e.message);
        show(currentId);
        if (onChange) onChange();
      }
    }

    function button(label, className, handler) {
      var btn = el(
        "button",
        "btn px-4 py-2 text-sm font-semibold " + className,
        label,
      );
      btn.type = "button";
      btn.addEventListener("click", handler);
      return btn;
    }

    function show(id) {
      currentId = id;
      var order = NovaPS.orders.adminGet(id);
      body.textContent = "";
      actions.textContent = "";
      rejectBox.hidden = true;
      rejectReason.value = "";
      rejectError.textContent = "";
      if (!order) {
        body.appendChild(
          el(
            "p",
            "py-6 text-center text-slate-500",
            "This order no longer exists.",
          ),
        );
        return;
      }

      var user = NovaPS.users.get(order.owner) || {};

      var info = section(body, "Order");
      kv(info, "Order ID", order.id);
      kv(info, "Status", "").lastChild.replaceWith(statusCell(order));
      if (order.type === "extend") {
        kv(info, "Type", "Extension of " + order.parentId);
        if (order.fine) {
          kv(
            info,
            "Late fee paid",
            NovaPS.money(order.fine) + " (" + order.fineMinutes + " min)",
            "text-red-600",
          );
        }
      }
      if (order.status === "complete" && order.type !== "extend") {
        // The rental is in the customer's hands: show the countdown and any late fee
        var left = NovaPS.rentals.msLeft(order);
        var pill = el(
          "span",
          "rounded-md px-2 py-0.5 text-xs text-white tabular-nums " +
            NovaPS.rentalTone(left).pill,
          NovaPS.formatHMS(left),
        );
        kv(info, "Time remaining", "").lastChild.replaceWith(pill);
        if (order.extraDays)
          kv(info, "Extended", "+" + NovaPS.formatDays(order.extraDays));
        var waitingExt = NovaPS.rentals.pendingExtension(order);
        if (waitingExt) {
          kv(
            info,
            "Extension waiting",
            "+" +
              NovaPS.formatDays(waitingExt.items[0].days) +
              " (" +
              waitingExt.id +
              "), clock paused",
            "text-indigo-500",
          );
        }
        if (left <= 0) {
          kv(
            info,
            "Late fee now",
            NovaPS.money(NovaPS.rentals.fine(order)) +
              " (" +
              NovaPS.rentals.fineMinutes(order) +
              " min)",
            "font-semibold text-red-600",
          );
        }
      }
      if (order.lateFee)
        kv(
          info,
          "Late fee to collect",
          NovaPS.money(order.lateFee) + " (" + order.lateMinutes + " min)",
          "font-semibold text-red-600",
        );
      kv(
        info,
        "Ordered",
        NovaPS.formatDate(order.createdAt) +
          ", " +
          NovaPS.formatTime(order.createdAt),
      );
      if (order.paidAt)
        kv(
          info,
          "Paid",
          NovaPS.formatDate(order.paidAt) +
            ", " +
            NovaPS.formatTime(order.paidAt),
        );
      if (order.shippedAt)
        kv(
          info,
          "Accepted",
          NovaPS.formatDate(order.shippedAt) +
            ", " +
            NovaPS.formatTime(order.shippedAt),
        );
      if (order.completedAt)
        kv(
          info,
          "Delivered",
          NovaPS.formatDate(order.completedAt) +
            ", " +
            NovaPS.formatTime(order.completedAt),
        );
      if (order.dueAt && order.status === "complete") {
        var late = Date.now() > order.dueAt;
        kv(
          info,
          "Return due",
          NovaPS.formatDate(new Date(order.dueAt).toISOString()),
          late ? "text-red-600" : "",
        );
      }
      if (order.returnedAt) {
        kv(
          info,
          "Returned",
          NovaPS.formatDate(order.returnedAt) +
            (order.returnedLate ? " (overdue)" : ""),
        );
      }
      if (order.cancelReason) kv(info, "Cancel reason", order.cancelReason);
      if (order.rejectReason) kv(info, "Reject reason", order.rejectReason);
      if (order.notes) kv(info, "Notes", order.notes);

      var customer = section(body, "Customer");
      kv(customer, "Name", order.customer.fullname);
      var phoneRow = kv(customer, "WhatsApp", order.customer.phone);
      var wa = whatsappLink(order.customer.phone);
      if (wa) {
        phoneRow.lastChild.appendChild(document.createTextNode(" "));
        phoneRow.lastChild.appendChild(wa);
      }
      kv(customer, "Email", order.customer.email);
      kv(customer, "Address", order.customer.address);
      customer.appendChild(el("p", "mt-2 text-xs text-slate-500", "ID card"));
      picture(customer, user.idcard, "Customer ID card");

      var units = section(body, "Units");
      order.items.forEach(function (item, i) {
        kv(
          units,
          "Unit " + (i + 1),
          NovaPS.PRODUCTS[item.unit].name +
            " · " +
            NovaPS.formatDays(item.days) +
            " · " +
            NovaPS.money(item.price),
        );
      });
      kv(units, "Total", NovaPS.money(order.total), "font-bold text-black");

      if (order.proof) {
        var proof = section(body, "Proof of payment");
        picture(proof, order.proof, "Proof of payment");
      }

      // Actions that fit the current status
      if (order.status === "pending") {
        actions.appendChild(
          button(
            "Reject",
            "border-red-600 bg-white text-red-600 hover:bg-red-600 hover:text-white",
            function () {
              rejectBox.hidden = false;
              rejectReason.focus();
            },
          ),
        );
        actions.appendChild(
          button(
            order.type === "extend" ? "Accept extension" : "Accept order",
            "btn-indigo",
            function () {
              act(
                "accept",
                "",
                order.type === "extend"
                  ? "Extension accepted"
                  : "Order accepted: it is now Shipped",
              );
            },
          ),
        );
      } else if (order.status === "shipped") {
        actions.appendChild(
          button("Confirm delivered", "btn-indigo", function () {
            act("deliver", "", "Order complete: the rental has started");
          }),
        );
      } else if (order.status === "complete") {
        actions.appendChild(
          button("Mark as returned", "btn-indigo", function () {
            act("return", "", "Unit returned: it is back in stock");
          }),
        );
      }
    }

    $("confirmReject").addEventListener("click", function () {
      var text = rejectReason.value.trim();
      if (text.length < 5) {
        rejectError.textContent =
          "Please write the reason (at least 5 characters).";
        rejectReason.focus();
        return;
      }
      act("reject", text, "Order rejected");
    });

    return {
      open: function (id) {
        show(id);
        m.open();
      },
    };
  }

  return {
    STATUS: STATUS,
    MONTHS: MONTHS,
    el: el,
    $: $,
    stack: stack,
    statusCell: statusCell,
    dateCell: dateCell,
    unitNames: unitNames,
    unitCounts: unitCounts,
    durationLines: durationLines,
    cell: cell,
    headRow: headRow,
    lookButton: lookButton,
    modal: modal,
    toast: toast,
    section: section,
    kv: kv,
    picture: picture,
    orderModal: orderModal,
  };
})();
