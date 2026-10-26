(function () {
  const { STORAGE, read, money } = window.NovaPS;
  const code = read(STORAGE.lastBooking, '');
  const booking = read(STORAGE.bookings, []).find((item) => item.code === code);

  if (!booking) return;

  const units = booking.units || [{ category: booking.category, days: booking.days }];
  const labels = {
    customer: booking.name || '',
    address: booking.address || '',
    unit: units.map((unit) => 'PS' + unit.category.slice(2)).join(' + '),
    duration: units.length === 1
      ? units[0].days + ' day'
      : units.map((unit) => 'PS' + unit.category.slice(2) + ' ' + unit.days + ' day').join(', '),
    total: money(booking.total),
  };

  Object.entries(labels).forEach(([key, value]) => {
    const element = document.querySelector('[data-confirm="' + key + '"]');
    if (element) element.textContent = value;
  });
})();
