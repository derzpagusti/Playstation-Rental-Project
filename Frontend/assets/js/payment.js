(function () {
  const { STORAGE, CATALOG, read, write, money, escapeHtml, toast } = window.NovaPS;
  const order = read(STORAGE.pendingOrder, null);
  const layout = document.querySelector('.payment-layout');
  const sendButton = document.querySelector('[data-send-payment]');
  const proofInput = document.querySelector('[data-proof-input]');
  const proofName = document.querySelector('[data-proof-name]');
  const timerElement = document.querySelector('[data-timer]');
  const timerHint = document.querySelector('[data-timer-hint]');

  function unitSummary(units) {
    return units.map((unit) => 'PS' + unit.category.slice(2)).join(' + ');
  }

  function durationSummary(units) {
    if (units.length === 1) {
      return units[0].days + ' day';
    }

    return units.map((unit) => 'PS' + unit.category.slice(2) + ' ' + unit.days + ' day').join(', ');
  }

  function showMissingOrder() {
    layout.innerHTML = '<section class="payment-card missing-order">' +
      '<h2>No order to pay for</h2>' +
      '<p>Start an order before opening payment confirmation.</p>' +
      '<a class="btn btn-purple" href="./booking.html">Go to Order Form</a>' +
      '</section>';
    sendButton.disabled = true;
  }

  function makeDemoQr() {
    const grid = document.querySelector('[data-qr]');
    if (!grid) return;

    function finderCell(x, y, left, top) {
      const localX = x - left;
      const localY = y - top;
      if (localX < 0 || localY < 0 || localX > 6 || localY > 6) return null;

      const edge = localX === 0 || localX === 6 || localY === 0 || localY === 6;
      const center = localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4;
      return edge || center;
    }

    let cells = '';
    for (let y = 0; y < 29; y += 1) {
      for (let x = 0; x < 29; x += 1) {
        const finder =
          finderCell(x, y, 0, 0) ??
          finderCell(x, y, 22, 0) ??
          finderCell(x, y, 0, 22);
        const dark = finder === null ? ((x * 17 + y * 31 + x * y) % 7 < 3) : finder;
        cells += '<span class="' + (dark ? 'is-dark' : '') + '"></span>';
      }
    }

    grid.innerHTML = cells;
  }

  if (!order) {
    showMissingOrder();
    return;
  }

  const summary = {
    customer: order.customer.name,
    unit: unitSummary(order.units),
    address: order.customer.address,
    duration: durationSummary(order.units),
    total: money(order.total),
  };

  Object.entries(summary).forEach(([key, value]) => {
    const target = document.querySelector('[data-summary="' + key + '"]');
    if (target) target.textContent = value;
  });
  document.querySelector('[data-payment-total]').textContent = money(order.total);
  makeDemoQr();

  function updateTimer() {
    const remaining = Math.max(0, order.expiresAt - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    timerElement.textContent =
      String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');

    if (remaining === 0) {
      timerHint.textContent = 'Payment time expired. Cancel this order to start again.';
      sendButton.disabled = true;
      return false;
    }

    sendButton.disabled = false;
    return true;
  }

  updateTimer();
  const timer = setInterval(() => {
    if (!updateTimer()) clearInterval(timer);
  }, 1000);

  proofInput.addEventListener('change', () => {
    const file = proofInput.files[0];
    proofName.textContent = file ? file.name : '';

    if (file && file.size > 5 * 1024 * 1024) {
      proofName.textContent = 'Choose an image smaller than 5 MB.';
      proofInput.value = '';
    }
    updateTimer();
  });

  document.querySelector('[data-cancel-order]').addEventListener('click', () => {
    localStorage.removeItem(STORAGE.pendingOrder);
    location.href = './booking.html';
  });

  sendButton.addEventListener('click', () => {
    const proof = proofInput.files[0];
    if (Date.now() >= order.expiresAt) return;

    const code = 'NPS-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const firstUnit = order.units[0];
    const booking = {
      code,
      category: firstUnit.category,
      unitName: unitSummary(order.units) + ' PlayStation',
      units: order.units,
      name: order.customer.name,
      phone: order.customer.phone,
      address: order.customer.address,
      email: order.customer.email,
      days: firstUnit.days,
      start: order.createdAt,
      payment: 'QRIS',
      proofName: proof?.name || '',
      idCardName: order.customer.idCardName,
      notes: order.notes,
      total: order.total,
      status: 'Pending',
      created: new Date().toISOString(),
    };

    const bookings = read(STORAGE.bookings, []);
    bookings.unshift(booking);
    write(STORAGE.bookings, bookings);
    write(STORAGE.lastBooking, code);
    localStorage.removeItem(STORAGE.pendingOrder);

    clearInterval(timer);
    toast('Demo payment submitted.');
    location.href = './confirmation.html';
  });
})();

