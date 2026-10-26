(function () {
  const { STORAGE, read, write, toast } = window.NovaPS;
  const fallbackAccount = {
    name: 'Cust 1',
    phone: '08xx-xxxx-xxxx',
    email: 'cust1@gmail.com',
    address: 'St. Veteran 12',
    idCardName: '',
  };

  function getProfile() {
    return { ...fallbackAccount, ...(read(STORAGE.session, null) || {}) };
  }

  function showAccountInfo() {
    const account = getProfile();

    document.querySelectorAll('[data-profile]').forEach((field) => {
      const property = field.dataset.profile;
      field.textContent = account[property] || '';
    });
  }

  function setupProfileEditor() {
    const form = document.querySelector('[data-profile-edit]');
    if (!form) return;

    const account = getProfile();
    const fields = ['name', 'phone', 'email', 'address'];
    const idCardInput = form.elements.idCard;
    const idCardHint = form.querySelector('[data-id-card-hint]');
    const error = form.querySelector('.form-error');

    fields.forEach((field) => {
      form.elements[field].value = account[field] || '';
    });

    if (account.idCardName) {
      idCardHint.textContent = account.idCardName;
    }

    idCardInput.addEventListener('change', () => {
      const selectedFile = idCardInput.files[0];
      idCardHint.textContent = selectedFile?.name || account.idCardName || 'Put your ID Card here';
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      error.textContent = '';

      const formData = new FormData(form);
      const session = read(STORAGE.session, null);
      const users = read(STORAGE.users, []);
      const oldEmail = (session?.email || account.email).toLowerCase();
      const email = String(formData.get('email')).trim().toLowerCase();
      const duplicate = users.some(
        (user) => user.email.toLowerCase() === email && user.email.toLowerCase() !== oldEmail,
      );

      if (duplicate) {
        error.textContent = 'That email address is already used by another demo account.';
        return;
      }

      const updatedAccount = {
        ...account,
        name: String(formData.get('name')).trim(),
        phone: String(formData.get('phone')).trim(),
        email,
        address: String(formData.get('address')).trim(),
        idCardName: idCardInput.files[0]?.name || account.idCardName || '',
      };
      const userIndex = users.findIndex((user) => user.email.toLowerCase() === oldEmail);

      if (userIndex >= 0) {
        users[userIndex] = { ...users[userIndex], ...updatedAccount };
      } else {
        users.push(updatedAccount);
      }

      write(STORAGE.users, users);
      write(STORAGE.session, updatedAccount);
      toast('Profile changes saved in this browser.');
      setTimeout(() => (location.href = './account-info.html'), 450);
    });
  }

  showAccountInfo();
  setupProfileEditor();
})();

