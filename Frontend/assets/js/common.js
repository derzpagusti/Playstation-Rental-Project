(function () {
  const STORAGE = {
    users: 'novaps_users_design',
    session: 'novaps_session_design',
    bookings: 'novaps_bookings_design',
    pendingOrder: 'novaps_pending_order_design',
    lastBooking: 'novaps_last_booking_design',
  };

  const CATALOG = {
    PS4: {
      daily: 50000,
      available: 10,
      features: [
        '1 PlayStation console + 2 controller',
        'A large collection of games',
        'HDMI Cable',
      ],
      games: [
        'EA FC26 (FIFA 26)',
        'Grand Theft Auto V (GTA V)',
        'Naruto Shippuden Ultimate Ninja Storm 4',
        'MotoGP 24',
        'Mortal Kombat 11',
        'Need For Speed Heat',
        'Tekken 7',
        'Red Dead Redemption 2 (RDR 2)',
      ],
    },
    PS5: {
      daily: 200000,
      available: 2,
      features: [
        '1 PlayStation console + 2 controller',
        'A large collection of games',
        'HDMI Cable',
        'Best display quality & new additional features',
      ],
      games: [
        'EA FC26 (FIFA 26)',
        'Grand Theft Auto V (GTA V)',
        'Minecraft',
        'Need for Speed Unbound',
      ],
    },
  };

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function money(value) {
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(value) || 0);
  }

  function escapeHtml(value) {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
  }

  function toast(message) {
    const element = document.getElementById('toast');
    if (!element) return;

    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove('show'), 2600);
  }

  function bookingCatalog() {
    const bookings = read(STORAGE.bookings, []);

    return Object.fromEntries(
      Object.entries(CATALOG).map(([type, unit]) => {
        const rented = bookings.reduce((count, booking) => {
          if (booking.status === 'Done') return count;

          const matchingUnits = Array.isArray(booking.units)
            ? booking.units.filter((rental) => rental.category === type).length
            : booking.category === type
              ? 1
              : 0;

          return count + matchingUnits;
        }, 0);

        return [type, { ...unit, available: Math.max(0, unit.available - rented) }];
      }),
    );
  }

  window.NovaPS = {
    STORAGE,
    CATALOG,
    read,
    write,
    money,
    escapeHtml,
    toast,
    bookingCatalog,
  };
})();

