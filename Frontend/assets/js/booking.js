(function () {
  const { STORAGE, CATALOG, read, bookingCatalog, money } = window.NovaPS;
  const form = document.querySelector('[data-order-form]');
  if (!form) return;

  const customer = {
    name: form.elements.name,
    phone: form.elements.phone,
    address: form.elements.address,
    email: form.elements.email,
    idCard: form.elements.idCard,
    notes: form.elements.notes,
  };
  const unitContainer = form.querySelector('[data-rental-units]');
  const addUnitButton = form.querySelector('[data-add-unit]');
  const checkoutButton = form.querySelector('.checkout-button');
  const error = form.querySelector('[data-order-error]');
  const requestedCategory = new URLSearchParams(location.search).get('category');
  const initialAvailability = bookingCatalog();
  const initialCategory = CATALOG[requestedCategory] && initialAvailability[requestedCategory].available > 0
    ? requestedCategory
    : initialAvailability.PS5.available > 0 ? 'PS5' : 'PS4';
  let units = [{ category: initialCategory, days: '' }];

  const session = read(STORAGE.session, null);
  if (session) {
    customer.name.value = session.name || '';
    customer.phone.value = session.phone || '';
    customer.address.value = session.address || '';
    customer.email.value = session.email || '';
  }

  function unitMarkup(unit, index, availability) {
    const choices = ['PS4', 'PS5']
      .map((category) => {
        const count = availability[category].available;
        const selected = unit.category === category ? 'selected' : '';
        const checked = unit.category === category ? 'checked' : '';
        const unavailable = count === 0 ? 'disabled' : '';
        const consoleName = 'PS ' + category.slice(2);
        const price = money(CATALOG[category].daily);

        return '<label class="unit-choice ' + selected + (count === 0 ? ' is-unavailable' : '') + '">' +
          '<input type="radio" name="unit-' + (index + 1) + '" value="' + category + '" data-unit-choice="' + index + '" ' + checked + ' ' + unavailable + ' required>' +
          '<span class="unit-choice-name">' + consoleName + ' | ' + price + '/day</span>' +
          '<span class="unit-choice-availability ' + (count < 5 ? 'unit-choice-unavailable' : '') + '">Available: ' + count + '</span>' +
          '</label>';
      })
      .join('');

    const durations = Array.from({ length: 7 }, (_, dayIndex) => {
      const day = dayIndex + 1;
      const selected = String(unit.days) === String(day) ? 'selected' : '';
      return '<option value="' + day + '" ' + selected + '>' + day + ' day' + (day > 1 ? 's' : '') + '</option>';
    }).join('');

    const unitNumber = index + 1;
    const heading = units.length > 1 ? 'Select a Unit #' + unitNumber : 'Select a Unit';
    const removeButton = index > 0
      ? '<button class="remove-unit" type="button" data-remove-unit="' + index + '" aria-label="Remove unit ' + unitNumber + '">♧</button>'
      : '';

    return '<div class="rental-unit" data-unit-index="' + index + '">' +
      '<div class="rental-unit-heading"><span>' + heading + '</span>' + removeButton + '</div>' +
      '<div class="unit-choice-list">' + choices + '</div>' +
      '<label class="form-field duration-field">Rental duration' +
      '<select data-unit-days="' + index + '" required><option value="">-- day</option>' + durations + '</select>' +
      '<span class="duration-help">Max. 7 days</span></label>' +
      '</div>';
  }

  function renderUnits() {
    const availability = bookingCatalog();
    unitContainer.innerHTML = units
      .map((unit, index) => unitMarkup(unit, index, availability))
      .join('');
    addUnitButton.hidden = units.length >= 2;
    updateCheckoutState();
  }

  function updateCheckoutState() {
    const customerComplete = Object.values(customer).every((field) => {
      if (field === customer.notes) return true;
      if (field === customer.idCard) return Boolean(field.files[0]);
      return Boolean(field.value.trim());
    });
    const unitsComplete = units.every((unit) => unit.category && Number(unit.days) >= 1);
    const availability = bookingCatalog();
    const hasStock = ['PS4', 'PS5'].every(
      (category) =>
        units.filter((unit) => unit.category === category).length <=
        availability[category].available,
    );

    error.textContent = hasStock ? '' : 'There are not enough available units for this selection.';
    checkoutButton.disabled = !(customerComplete && unitsComplete && hasStock);
  }

  addUnitButton.addEventListener('click', () => {
    if (units.length >= 2) return;
    const secondCategory = bookingCatalog().PS4.available > 0 ? 'PS4' : 'PS5';
    units.push({ category: secondCategory, days: '' });
    renderUnits();
  });

  unitContainer.addEventListener('change', (event) => {
    const choice = event.target.closest('[data-unit-choice]');
    const duration = event.target.closest('[data-unit-days]');

    if (choice) {
      units[Number(choice.dataset.unitChoice)].category = choice.value;
      renderUnits();
      return;
    }

    if (duration) {
      units[Number(duration.dataset.unitDays)].days = duration.value;
      updateCheckoutState();
    }
  });

  unitContainer.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove-unit]');
    if (!removeButton) return;

    units.splice(Number(removeButton.dataset.removeUnit), 1);
    renderUnits();
  });

  Object.values(customer).forEach((field) => {
    field.addEventListener('input', updateCheckoutState);
    field.addEventListener('change', () => {
      if (field === customer.idCard) {
        form.querySelector('[data-id-hint]').textContent =
          field.files[0]?.name || 'Choose an image of your ID card';
      }
      updateCheckoutState();
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    error.textContent = '';

    if (!form.reportValidity()) return;
    if (units.some((unit) => !unit.category || !unit.days)) {
      error.textContent = 'Choose a unit and rental duration for each unit.';
      return;
    }

    const total = units.reduce(
      (sum, unit) => sum + CATALOG[unit.category].daily * Number(unit.days),
      0,
    );
    const now = Date.now();
    const order = {
      customer: {
        name: customer.name.value.trim(),
        phone: customer.phone.value.trim(),
        address: customer.address.value.trim(),
        email: customer.email.value.trim().toLowerCase(),
        idCardName: customer.idCard.files[0]?.name || '',
      },
      units: units.map((unit) => ({
        category: unit.category,
        days: Number(unit.days),
        dailyPrice: CATALOG[unit.category].daily,
      })),
      notes: customer.notes.value.trim(),
      paymentMethod: 'QRIS',
      total,
      createdAt: new Date(now).toISOString(),
      expiresAt: now + 5 * 60 * 1000,
    };

    write(STORAGE.pendingOrder, order);
    location.href = './payment-confirmation.html';
  });

  renderUnits();
})();


