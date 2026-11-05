/*
 * Payment Confirmation page: QRIS, 5 minute countdown, proof upload, cancel.
 * Requires js/shared/session.js, orders.js and image.js.
 *
 * Demo: sending the proof marks the order "pending" (waiting for the admin).
 */
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  var id = new URLSearchParams(location.search).get("order");
  var order = id ? NovaPS.orders.get(id) : null;

  if (!order) {
    location.replace("order-status.html");
    return;
  }
  if (order.status !== "not_paid") {
    location.replace("order-detail.html?order=" + encodeURIComponent(id));
    return;
  }

  var countdown = $("countdown");
  var sendBtn = $("send-btn");
  var proof = $("proof");
  var upload = document.querySelector("[data-upload]");
  var proofField = proof.closest("[data-field]");

  $("amount").textContent = NovaPS.money(order.total);
  NovaPS.renderRows($("summary-rows"), NovaPS.summaryRows(order));

  /* ---------- countdown ---------- */

  function goToDetail() {
    location.replace("order-detail.html?order=" + encodeURIComponent(id));
  }

  function tick() {
    var left = NovaPS.orders.msLeft(order);
    if (left <= 0) {
      NovaPS.orders.get(id); // cancels the order and gives the stock back
      goToDetail();
      return;
    }
    countdown.textContent = NovaPS.formatClock(left, true);
    var urgent = left <= 60 * 1000; // last minute: red + pulsing
    countdown.classList.toggle("text-red-600", urgent);
    countdown.classList.toggle("animate-pulse", urgent);
  }

  tick();
  var timer = setInterval(tick, 1000);

  /* ---------- proof of payment ---------- */

  function setProofError(text) {
    proofField.toggleAttribute("data-invalid", !!text);
    proofField.querySelector("[data-error]").textContent = text;
  }

  proof.addEventListener("change", function () {
    var file = proof.files[0];
    sendBtn.disabled = true;
    upload.removeAttribute("data-has-image");
    setProofError("");
    if (!file) return;

    if (!/^image\//.test(file.type))
      return setProofError("The proof must be an image.");
    if (file.size > 5 * 1024 * 1024)
      return setProofError("The image must be 5 MB or smaller.");

    upload.querySelector("img").src = URL.createObjectURL(file);
    upload.setAttribute("data-has-image", "");
    sendBtn.disabled = false; // Send payment only works after a proof is chosen
  });

  sendBtn.addEventListener("click", function () {
    var file = proof.files[0];
    if (!file) return;
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending…";

    NovaPS.imageToDataUrl(file, 1000)
      .then(function (dataUrl) {
        // TODO: upload the proof to the backend API for the admin to verify.
        NovaPS.orders.pay(id, dataUrl);
        clearInterval(timer);
        goToDetail();
      })
      .catch(function (err) {
        setProofError(err.message);
        sendBtn.textContent = "Send payment";
        sendBtn.disabled = false;
        if (NovaPS.orders.msLeft(order) <= 0) goToDetail();
      });
  });

  /* ---------- cancel order (reason is required) ---------- */

  var modal = $("cancelModal");
  var reason = $("reason");
  var reasonField = reason.closest("[data-field]");
  var lastFocus = null;

  function setModal(open) {
    modal.toggleAttribute("data-open", open);
    modal.setAttribute("aria-hidden", String(!open));
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

  function setReasonError(text) {
    reasonField.toggleAttribute("data-invalid", !!text);
    reasonField.querySelector("[data-error]").textContent = text;
  }

  $("cancel-btn").addEventListener("click", function () {
    setModal(true);
  });
  modal.addEventListener("click", function (e) {
    if (e.target === modal || e.target.hasAttribute("data-close"))
      setModal(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.hasAttribute("data-open")) setModal(false);
  });

  [].slice
    .call(modal.querySelectorAll("[data-reason]"))
    .forEach(function (chip) {
      chip.addEventListener("click", function () {
        reason.value = chip.dataset.reason;
        setReasonError("");
        reason.focus();
      });
    });
  reason.addEventListener("input", function () {
    if (reason.value.trim().length >= 5) setReasonError("");
  });

  $("confirm-cancel").addEventListener("click", function () {
    var text = reason.value.trim();
    if (text.length < 5) {
      setReasonError("Please write your reason (at least 5 characters).");
      reason.focus();
      return;
    }
    try {
      NovaPS.orders.cancel(id, text);
    } catch (e) {
      // already canceled / expired: the detail page shows the real status
    }
    clearInterval(timer);
    goToDetail();
  });
})();
