/*
 * "Cancel order" pop-up for customers (Order Status and Look Detail).
 * Requires js/shared/session.js and js/shared/orders.js.
 *
 *   NovaPS.askCancel(orderId, onDone)
 *
 * The customer must write a reason (at least 5 characters). Only orders that
 * are still "Not Paid" can be canceled; the unit goes back to stock.
 */
(function () {
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  var root = el(
    "div",
    "group invisible fixed inset-0 z-[65] grid place-items-center bg-slate-950/60 p-6 opacity-0 transition-all duration-200 data-[open]:visible data-[open]:opacity-100",
  );
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "cancelAskTitle");
  root.setAttribute("aria-hidden", "true");

  var box = el(
    "div",
    "w-full max-w-[420px] translate-y-4 scale-95 rounded-xl bg-white px-7 pb-7 pt-8 text-left transition-transform duration-300 ease-[cubic-bezier(.2,.9,.3,1.2)] group-data-[open]:translate-y-0 group-data-[open]:scale-100",
  );
  var title = el("h2", "font-display text-2xl font-bold", "Cancel this order?");
  title.id = "cancelAskTitle";
  var info = el("p", "mt-1 text-slate-500");
  var chips = el("div", "mt-4 flex flex-wrap gap-2");
  var label = el("label", "mt-3 mb-0.5 block text-base", "Reason");
  var reason = el("textarea", "field-input h-auto resize-none py-2");
  reason.id = "cancelAskReason";
  reason.rows = 3;
  reason.maxLength = 200;
  reason.placeholder = "Write your reason here";
  label.htmlFor = reason.id;
  var error = el("p", "mt-0.5 text-[11px] text-red-600 empty:hidden");
  error.setAttribute("role", "alert");
  var row = el("div", "mt-5 flex gap-3");
  var keep = el(
    "button",
    "btn btn-ghost flex-1 px-0 py-[11px] text-base",
    "Keep order",
  );
  keep.type = "button";
  var confirm = el(
    "button",
    "btn flex-1 bg-red-600 px-0 py-[11px] text-base text-white",
    "Cancel order",
  );
  confirm.type = "button";
  row.appendChild(keep);
  row.appendChild(confirm);

  ["Changed my mind", "Wrong unit or duration", "Payment problem"].forEach(
    function (text) {
      var chip = el(
        "button",
        "cursor-pointer rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 transition-all duration-150 hover:-translate-y-0.5 hover:border-indigo-500 hover:text-indigo-600 active:scale-95",
        text,
      );
      chip.type = "button";
      chip.addEventListener("click", function () {
        reason.value = text;
        error.textContent = "";
        reason.focus();
      });
      chips.appendChild(chip);
    },
  );

  [title, info, chips, label, reason, error, row].forEach(function (node) {
    box.appendChild(node);
  });
  root.appendChild(box);

  var orderId = null;
  var onDone = null;
  var lastFocus = null;

  function setOpen(open) {
    root.toggleAttribute("data-open", open);
    root.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("overflow-hidden", open);
    if (open) {
      lastFocus = document.activeElement;
      setTimeout(function () {
        reason.focus();
      }, 50);
    } else if (lastFocus) {
      lastFocus.focus();
    }
  }

  keep.addEventListener("click", function () {
    setOpen(false);
  });
  root.addEventListener("click", function (e) {
    if (e.target === root) setOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && root.hasAttribute("data-open")) setOpen(false);
  });
  reason.addEventListener("input", function () {
    if (reason.value.trim().length >= 5) error.textContent = "";
  });

  confirm.addEventListener("click", function () {
    var text = reason.value.trim();
    if (text.length < 5) {
      error.textContent = "Please write your reason (at least 5 characters).";
      reason.focus();
      return;
    }
    try {
      // TODO: cancel the order through the backend API.
      NovaPS.orders.cancel(orderId, text);
    } catch (e) {
      // already paid / expired: the page below shows the real status
    }
    setOpen(false);
    if (onDone) onDone();
  });

  NovaPS.askCancel = function (id, done) {
    orderId = id;
    onDone = done;
    var order = NovaPS.orders.get(id);
    info.textContent =
      (order ? order.id + " · " + NovaPS.money(order.total) + ". " : "") +
      "The unit goes back to stock.";
    reason.value = "";
    error.textContent = "";
    if (!root.parentNode) document.body.appendChild(root);
    setOpen(true);
  };
})();
