/*
 * "Your rental is ending" pop-ups for customers, on every customer page.
 * Requires js/shared/session.js and js/shared/orders.js.
 *
 *  - less than 4 hours left  -> pop-up (once per rental)
 *  - less than 1 hour left   -> pop-up (once per rental)
 *  - overdue                 -> pop-up that cannot be closed. The customer can
 *    only open Time Remaining (and pay an extension): no ordering, no profile.
 *    Late fee: Rp 1.000 for every minute after the time is over.
 *
 * Demo: the timers run in the browser. Real deadlines must be kept by the server.
 */
(function () {
  if (!NovaPS.isLoggedIn()) return;

  var ALERTS_KEY = "novaps_alerts";
  var inPages = /\/pages\//.test(location.pathname);
  var base = inPages ? "" : "pages/";
  var page =
    location.pathname
      .split("/")
      .pop()
      .replace(/\.html$/, "") || "index";

  // Overdue customers may only use these pages (to view time and pay an extension)
  var ALLOWED_WHEN_OVERDUE = [
    "time-remaining",
    "extend",
    "payment",
    "order-detail",
  ];
  // Do not interrupt these pages with the "ends soon" pop-ups
  var QUIET = ["extend", "payment"];

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function seenAlerts() {
    try {
      return JSON.parse(localStorage.getItem(ALERTS_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function markSeen(orderId, level) {
    var seen = seenAlerts();
    seen[orderId] = seen[orderId] || {};
    seen[orderId][level] = true;
    if (level === "h1") seen[orderId].h4 = true; // the 4 hour warning is no longer needed
    try {
      localStorage.setItem(ALERTS_KEY, JSON.stringify(seen));
    } catch (e) {}
  }

  function unitNames(order) {
    return order.items
      .map(function (i) {
        return NovaPS.PRODUCTS[i.unit].name;
      })
      .join(" + ");
  }

  /* ---------- the pop-up (built once) ---------- */

  var root = el(
    "div",
    "group invisible fixed inset-0 z-[70] grid place-items-center bg-slate-950/70 p-6 opacity-0 transition-all duration-200 data-[open]:visible data-[open]:opacity-100",
  );
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-hidden", "true");

  var box = el(
    "div",
    "max-h-[92vh] w-full max-w-[420px] translate-y-4 scale-95 overflow-y-auto rounded-xl bg-white px-7 pb-6 pt-8 text-center transition-transform duration-300 ease-[cubic-bezier(.2,.9,.3,1.2)] group-data-[open]:translate-y-0 group-data-[open]:scale-100",
  );
  var icon = el(
    "div",
    "mx-auto mb-3.5 grid size-14 place-items-center rounded-full",
  );
  var title = el("h2", "font-display text-2xl font-bold text-black");
  var text = el("p", "mt-1.5 text-slate-500");
  var clock = el("p", "mt-4 font-display text-5xl font-bold");
  var info = el("p", "mt-1 text-sm text-slate-500");
  var fineBox = el(
    "p",
    "mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700",
  );
  var actions = el("div", "mt-5 flex gap-3");
  var logout = el(
    "button",
    "mt-4 cursor-pointer text-xs text-slate-400 underline underline-offset-2 transition-colors hover:text-slate-600",
    "Log out",
  );
  logout.type = "button";
  logout.addEventListener("click", function () {
    NovaPS.logout();
    location.href = inPages ? "../index.html" : "index.html";
  });
  [icon, title, text, clock, info, fineBox, actions, logout].forEach(
    function (node) {
      box.appendChild(node);
    },
  );
  root.appendChild(box);

  var CLOCK_ICON =
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
  var WARN_ICON =
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>';

  var current = null; // { kind, order }
  var banner = null;

  function linkButton(label, href, className) {
    var a = el("a", "btn flex-1 px-2 py-[11px] text-base " + className, label);
    a.href = href;
    return a;
  }

  function extendHref(order) {
    return base + "extend.html?order=" + encodeURIComponent(order.id);
  }

  function setOpen(open) {
    root.toggleAttribute("data-open", open);
    root.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("overflow-hidden", open);
  }

  var COPY = {
    h4: {
      tone: "bg-amber-100 text-amber-600",
      icon: CLOCK_ICON,
      title: "Your rental ends in less than 4 hours",
      text: "Please return the unit to NovaPS, or extend your rental before the time runs out. After that, a late fee of Rp 1.000 per minute applies.",
    },
    h1: {
      tone: "bg-orange-100 text-orange-700",
      icon: CLOCK_ICON,
      title: "Less than 1 hour left!",
      text: "Return the unit now, or extend your rental. After the time is over, a late fee of Rp 1.000 per minute applies.",
    },
    over: {
      tone: "bg-red-100 text-red-700",
      icon: WARN_ICON,
      title: "Your rental is overdue",
      text: "Return the unit to NovaPS, or extend your rental and pay the late fee. Until then you can only view Time Remaining and you cannot order.",
    },
  };

  function open(kind, order) {
    current = { kind: kind, order: order };
    var copy = COPY[kind];
    // A paid extension is waiting for the admin: the late fee is paused
    var waiting = kind === "over" && !!NovaPS.rentals.pendingExtension(order);
    current.waiting = waiting;
    icon.className =
      "mx-auto mb-3.5 grid size-14 place-items-center rounded-full " +
      copy.tone;
    icon.innerHTML = copy.icon; // fixed strings above, never user input
    title.textContent = waiting ? "Waiting for admin verification" : copy.title;
    text.textContent = waiting
      ? "Your extension payment was received. The late fee is paused until the admin verifies it. Until then you can only view Time Remaining."
      : copy.text;
    info.textContent = unitNames(order) + " · " + order.id;
    fineBox.hidden = kind !== "over";
    logout.hidden = kind !== "over";

    actions.textContent = "";
    if (kind === "over") {
      if (page !== "time-remaining") {
        actions.appendChild(
          linkButton(
            "Time Remaining",
            base + "time-remaining.html",
            "btn-ghost",
          ),
        );
      }
      if (!waiting) {
        actions.appendChild(
          linkButton("Extend & pay fine", extendHref(order), "btn-indigo"),
        );
      }
    } else {
      var later = el(
        "button",
        "btn btn-ghost flex-1 px-2 py-[11px] text-base",
        "Later",
      );
      later.type = "button";
      later.addEventListener("click", function () {
        setOpen(false);
        current = null;
      });
      actions.appendChild(later);
      actions.appendChild(
        linkButton("Extend rental", extendHref(order), "btn-indigo"),
      );
    }
    update();
    setOpen(true);
  }

  // Live numbers inside the open pop-up
  function update() {
    if (!current) return;
    var left = NovaPS.rentals.msLeft(current.order);
    clock.textContent = NovaPS.formatHMS(left);
    clock.className =
      "mt-4 font-display text-5xl font-bold " + NovaPS.rentalTone(left).text;
    if (current.kind === "over") {
      fineBox.textContent =
        (current.waiting ? "Late fee paused at: " : "Late fee so far: ") +
        NovaPS.money(NovaPS.rentals.fine(current.order)) +
        " (" +
        NovaPS.rentals.fineMinutes(current.order) +
        " min × " +
        NovaPS.money(NovaPS.FINE_PER_MIN) +
        ")";
    }
  }

  /* ---------- banner on the pages an overdue customer may still use ---------- */

  function showBanner(order) {
    if (!banner) {
      banner = el("div", "bg-red-700 px-4 py-2 text-center text-sm text-white");
      document.body.insertBefore(banner, document.body.firstChild);
    }
    var fine = NovaPS.money(NovaPS.rentals.fine(order));
    var waiting = !!NovaPS.rentals.pendingExtension(order);
    banner.textContent = "";
    banner.appendChild(
      document.createTextNode(
        "Your rental is overdue (" +
          NovaPS.formatHMS(NovaPS.rentals.msLeft(order)) +
          (waiting
            ? "). Extension waiting for admin verification, late fee paused at: "
            : "). Late fee so far: ") +
          fine +
          ". ",
      ),
    );
    if (!waiting && page !== "extend" && page !== "payment") {
      var link = el(
        "a",
        "font-semibold underline underline-offset-2",
        "Extend & pay fine",
      );
      link.href = extendHref(order);
      banner.appendChild(link);
    }
  }

  function hideBanner() {
    if (banner) {
      banner.remove();
      banner = null;
    }
  }

  /* ---------- check every second ---------- */

  function check() {
    var rentals = NovaPS.rentals.mine();
    var overdue = rentals.filter(function (o) {
      return NovaPS.rentals.msLeft(o) <= 0;
    })[0];

    if (overdue) {
      if (ALLOWED_WHEN_OVERDUE.indexOf(page) !== -1) {
        showBanner(overdue);
        if (current && current.kind === "over") {
          setOpen(false);
          current = null;
        }
      } else {
        hideBanner();
        var waitingNow = !!NovaPS.rentals.pendingExtension(overdue);
        if (
          !current ||
          current.kind !== "over" ||
          current.waiting !== waitingNow
        ) {
          open("over", overdue);
        } else {
          update();
        }
      }
      return;
    }

    hideBanner();
    if (current && current.kind === "over") {
      setOpen(false); // an extension was paid or the unit was returned
      current = null;
    }
    if (current) {
      update();
      return;
    }
    if (QUIET.indexOf(page) !== -1) return;

    var seen = seenAlerts();
    for (var i = 0; i < rentals.length; i++) {
      var order = rentals[i];
      var left = NovaPS.rentals.msLeft(order);
      var shown = seen[order.id] || {};
      var level =
        left <= NovaPS.HOUR_MS ? "h1" : left <= 4 * NovaPS.HOUR_MS ? "h4" : "";
      if (level && !shown[level] && !(level === "h4" && shown.h1)) {
        markSeen(order.id, level);
        open(level, order);
        return;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(root);
    check();
    setInterval(check, 1000);
  });
})();
