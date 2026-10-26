(function () {
  const { STORAGE, read, escapeHtml, money } = window.NovaPS;
  const container = document.querySelector('[data-status-content]');
  if (!container) return;

  const bookings = read(STORAGE.bookings, []);

  if (bookings.length === 0) {
    container.innerHTML =
      '<div class="empty-state">' +
      '<p>You haven\'t ordered anything yet</p>' +
      '<a class="btn btn-purple" href="./units.html">Order Now</a>' +
      '</div>';
    return;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Schedule to be confirmed';

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function getUnits(booking) {
    return booking.units || [{ category: booking.category, days: booking.days || 1 }];
  }

  function unitLabel(booking) {
    return getUnits(booking)
      .map((unit) => 'PS' + String(unit.category).slice(2))
      .join(' + ');
  }

  function durationLabel(booking) {
    return getUnits(booking)
      .map((unit) => unit.days + ' day')
      .join(', ');
  }

  function renderBooking(booking) {
    const status = String(booking.status || 'Pending');
    const statusClass = status.toLowerCase().includes('ship')
      ? 'shipping'
      : status.toLowerCase() === 'done'
        ? 'done'
        : 'pending';
    const statusLabel = status === 'Shipping' ? 'Shipping...' : status;
    const isDone = status === 'Done';

    return '<article class="status-card" data-booking-card="' + escapeHtml(booking.code) + '">' +
      '<div class="status-card-main">' +
      '<h2>#' + escapeHtml(booking.code) + '</h2>' +
      '<p>' + escapeHtml(unitLabel(booking)) + ', ' + formatDate(booking.start) + ', ' + escapeHtml(durationLabel(booking)) + '</p>' +
      '<p>Total ' + money(booking.total) + '</p>' +
      '</div>' +
      '<div class="status-side">' +
      '<span class="status-label ' + statusClass + '">' + escapeHtml(statusLabel) + '</span>' +
      (isDone
        ? '<a class="again-btn" href="./booking.html?category=' + encodeURIComponent(booking.category) + '">Order Again</a>'
        : '<button class="detail-btn" type="button" data-detail="' + escapeHtml(booking.code) + '">Look Detail</button>') +
      '</div>' +
      '</article>';
  }

  container.innerHTML = '<div class="status-list">' + bookings.map(renderBooking).join('') + '</div>';

  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-detail]');
    if (!button) return;

    const booking = bookings.find((item) => item.code === button.dataset.detail);
    const card = button.closest('.status-card');
    if (!booking || !card) return;

    const existingDetails = card.querySelector('.booking-details');
    if (existingDetails) {
      existingDetails.remove();
      card.classList.remove('expanded');
      button.textContent = 'Look Detail';
      return;
    }

    const details = document.createElement('div');
    details.className = 'booking-details';
    details.innerHTML =
      '<strong>Customer:</strong> ' + escapeHtml(booking.name) + '<br>' +
      '<strong>Phone:</strong> ' + escapeHtml(booking.phone) + '<br>' +
      '<strong>Address:</strong> ' + escapeHtml(booking.address) + '<br>' +
      '<strong>Payment:</strong> ' + escapeHtml(booking.payment);

    card.append(details);
    card.classList.add('expanded');
    button.textContent = 'Hide Detail';
  });
})();
