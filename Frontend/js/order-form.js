/*
 * Order Form page.
 * Requires js/shared/session.js, validation.js, image.js and orders.js.
 *
 * Flow: pick a unit -> pick a duration (max 7 days) -> summary appears ->
 * Checkout reserves the stock and opens the payment page (5 minute timer).
 */
(function () {
  var PRODUCTS = NovaPS.PRODUCTS;
  var CUSTOMER_FIELDS = ["fullname", "phone", "address", "email"];

  // A user may only have one unpaid order: send them home, where the
  // "complete your payment" pop-up explains it.
  if (NovaPS.orders.unpaid()) {
    location.replace("../index.html");
    return;
  }

  function $(id) {
    return document.getElementById(id);
  }

  var form = $("order-form");
  var unitsEl = $("units");
  var template = $("unit-template");
  var addWrap = $("add-unit-wrap");
  var summary = $("summary");
  var checkout = $("checkout");
  var hint = $("checkout-hint");
  var formError = $("form-error");
  var upload = form.querySelector("[data-upload]");
  var idInput = $("idcard");
  var profile = NovaPS.profile.get();
  var blocks = [];

  /* ---------- customer information (from the account) ---------- */

  CUSTOMER_FIELDS.forEach(function (key) {
    var input = $(key);
    input.value = profile[key] || "";
    input.readOnly = !!input.value; // filled in from My Profile = locked
  });

  if (profile.idcard) {
    upload.querySelector("img").src = profile.idcard;
    upload.setAttribute("data-has-image", "");
    idInput.disabled = true;
    idInput.removeAttribute("data-validate");
  }

  function customerComplete() {
    var ok = CUSTOMER_FIELDS.every(function (key) {
      var input = $(key);
      return (
        NovaPS.rules[input.dataset.validate](input.value, input, form) === ""
      );
    });
    return ok && (!!profile.idcard || !!idInput.files[0]);
  }

  CUSTOMER_FIELDS.forEach(function (key) {
    var input = $(key);
    input.addEventListener("input", function () {
      if (input.closest("[data-field]").hasAttribute("data-invalid"))
        NovaPS.checkField(input, form);
      refresh();
    });
    input.addEventListener("blur", function () {
      if (!input.readOnly) NovaPS.checkField(input, form);
    });
  });

  idInput.addEventListener("change", function () {
    var file = idInput.files[0];
    var isImage = !!file && /^image\//.test(file.type);
    if (isImage) upload.querySelector("img").src = URL.createObjectURL(file);
    upload.toggleAttribute("data-has-image", isImage);
    NovaPS.checkField(idInput, form);
    refresh();
  });

  /* ---------- unit blocks (1 or 2 units) ---------- */

  function unitOf(block) {
    var radio = block.querySelector("input:checked");
    return radio ? radio.value : "";
  }

  function daysOf(block) {
    return Number(block.querySelector("[data-duration]").value) || 0;
  }

  function renumber() {
    blocks.forEach(function (block, i) {
      block.querySelector("[data-unit-title]").textContent =
        blocks.length > 1 ? "Select a Unit #" + (i + 1) : "Select a Unit";
      block.querySelector("[data-remove-unit]").hidden = i === 0; // the first unit stays
      block.querySelectorAll('input[type="radio"]').forEach(function (radio) {
        radio.name = "unit-" + (i + 1);
      });
    });
    addWrap.hidden = blocks.length >= NovaPS.MAX_UNITS;
  }

  function addBlock() {
    var block = template.content.firstElementChild.cloneNode(true);
    unitsEl.appendChild(block);
    blocks.push(block);
    block.addEventListener("change", refresh);
    block
      .querySelector("[data-remove-unit]")
      .addEventListener("click", function () {
        blocks.splice(blocks.indexOf(block), 1);
        block.remove();
        renumber();
        refresh();
      });
    renumber();
    refresh();
    return block;
  }

  $("add-unit").addEventListener("click", function () {
    addBlock().querySelector("input").focus();
  });

  /* ---------- refresh everything that depends on the choices ---------- */

  function refresh() {
    var stock = {};
    Object.keys(PRODUCTS).forEach(function (unit) {
      stock[unit] = NovaPS.stock.get(unit);
    });
    var selected = blocks.map(unitOf);
    var stockProblem = false;

    blocks.forEach(function (block, i) {
      var others = selected.filter(function (unit, j) {
        return j !== i;
      });
      var errors = "";

      block.querySelectorAll('input[type="radio"]').forEach(function (radio) {
        var unit = radio.value;
        var used = others.filter(function (u) {
          return u === unit;
        }).length;
        var left = stock[unit] - used;
        var label = radio.closest("label").querySelector("[data-available]");

        label.textContent = left > 0 ? "Available: " + left : "Sold out";
        label.className =
          "shrink-0 " +
          (left <= 0
            ? "text-red-600"
            : left <= NovaPS.LOW_STOCK
              ? "text-yellow-600"
              : "text-slate-800");
        radio.disabled = left <= 0 && !radio.checked;
        if (radio.checked && left < 1) {
          errors = "Not enough " + PRODUCTS[unit].name + " in stock.";
          stockProblem = true;
        }
      });

      // The duration can only be chosen after a unit is picked
      var select = block.querySelector("[data-duration]");
      select.disabled = !selected[i];
      if (!selected[i]) select.value = "";
      block.querySelector("[data-block-error]").textContent = errors;
    });

    // Order summary: only units that have both a unit and a duration
    var items = [];
    blocks.forEach(function (block) {
      var unit = unitOf(block);
      var days = daysOf(block);
      if (unit && days)
        items.push({
          unit: unit,
          days: days,
          price: PRODUCTS[unit].price * days,
        });
    });

    summary.hidden = items.length === 0;
    if (items.length) {
      var total = items.reduce(function (sum, item) {
        return sum + item.price;
      }, 0);
      NovaPS.renderRows(
        $("summary-rows"),
        NovaPS.summaryRows({
          customer: {
            fullname: $("fullname").value.trim() || "-",
            address: $("address").value.trim() || "-",
          },
          items: items,
          total: total,
        }),
      );
    }

    // Checkout button + the reason why it is still disabled
    var message = "";
    if (
      blocks.some(function (b) {
        return !unitOf(b);
      })
    )
      message = "Select a unit to continue.";
    else if (
      blocks.some(function (b) {
        return !daysOf(b);
      })
    )
      message = "Choose a rental duration to continue.";
    else if (stockProblem)
      message = "Change a unit: there is not enough stock.";
    else if (!customerComplete())
      message = "Complete your customer information to continue.";

    checkout.disabled = !!message;
    hint.textContent = message;
  }

  /* ---------- checkout ---------- */

  function showError(text) {
    formError.textContent = text;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    showError("");

    var ok = true;
    [].slice
      .call(form.querySelectorAll("[data-validate]"))
      .forEach(function (el) {
        if (!el.disabled && !NovaPS.checkField(el, form)) ok = false;
      });
    if (!ok || checkout.disabled) return;

    checkout.disabled = true;
    checkout.textContent = "Please wait…";

    var customer = {
      fullname: $("fullname").value.trim(),
      phone: $("phone").value.trim(),
      address: $("address").value.trim(),
      email: $("email").value.trim(),
    };
    var items = blocks.map(function (block) {
      return { unit: unitOf(block), days: daysOf(block) };
    });
    var file = idInput.files[0];
    var idPromise =
      file && !profile.idcard
        ? NovaPS.imageToDataUrl(file, 900)
        : Promise.resolve(profile.idcard || "");

    idPromise
      .then(function (idcard) {
        // Remember the details for next time (and for My Profile)
        var patch = Object.assign({}, customer);
        if (idcard) patch.idcard = idcard;
        NovaPS.profile.set(patch);

        // TODO: send the order to the backend API. The server must reserve the stock.
        var order = NovaPS.orders.create({
          customer: customer,
          items: items,
          notes: $("notes").value.trim(),
        });
        location.href = "payment.html?order=" + encodeURIComponent(order.id);
      })
      .catch(function (err) {
        showError(err.message);
        checkout.textContent = "Checkout";
        refresh();
      });
  });

  /* ---------- start ---------- */

  var first = addBlock();

  // "Choose & Rent" on the home page sends ?unit=ps4 or ?unit=ps5
  var wanted = new URLSearchParams(location.search).get("unit");
  if (wanted && PRODUCTS[wanted]) {
    var radio = first.querySelector('input[value="' + wanted + '"]');
    if (radio && !radio.disabled) {
      radio.checked = true;
      refresh();
      first.querySelector("[data-duration]").focus();
    }
  }

  window.addEventListener("pageshow", refresh);
})();
