(function () {
  const { STORAGE, read, write, toast } = window.NovaPS;
  const form = document.querySelector('[data-auth]');
  if (!form) return;

  function showError(message) {
    form.querySelector('.form-error').textContent = message;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    showError('');

    const data = new FormData(form);
    const type = form.dataset.auth;
    const users = read(STORAGE.users, []);

    if (type === 'login') {
      const email = String(data.get('email')).trim().toLowerCase();
      const password = String(data.get('password'));
      let account = users.find((user) => user.email === email);

      // Demo login accepts any valid email and a non-empty password.
      if (!account) {
        account = { name: email.split('@')[0], email, phone: '', address: '' };
        users.push({ ...account, password });
        write(STORAGE.users, users);
      }

      write(STORAGE.session, {
        name: account.name,
        email: account.email,
        phone: account.phone || '',
        address: account.address || '',
      });
      toast('Login successful. Demo account is ready.');
      setTimeout(() => (location.href = './index.html'), 450);
      return;
    }

    const password = String(data.get('password') || '');
    const confirmPassword = String(data.get('confirmPassword') || '');

    if (password.length < 8 || !/[0-9]/.test(password)) {
      showError('Password must have at least 8 characters and a number.');
      return;
    }

    if (password !== confirmPassword) {
      showError('Passwords do not match.');
      return;
    }

    if (type === 'signup') {
      const email = String(data.get('email')).trim().toLowerCase();
      if (users.some((user) => user.email === email)) {
        showError('An account with this email already exists.');
        return;
      }

      const account = {
        name: String(data.get('name')).trim(),
        email,
        phone: String(data.get('phone')).trim(),
        address: String(data.get('address')).trim(),
        idCardName: data.get('idCard')?.name || '',
      };

      users.push({ ...account, password });
      write(STORAGE.users, users);
      write(STORAGE.session, {
        name: account.name,
        email: account.email,
        phone: account.phone,
        address: account.address,
      });
      toast('Account created. Welcome to NovaPS!');
      setTimeout(() => (location.href = './index.html'), 450);
      return;
    }

    if (type === 'change-password') {
      const email = String(data.get('email')).trim().toLowerCase();
      const account = users.find((user) => user.email === email);

      if (!account) {
        showError('No demo account found for this email.');
        return;
      }

      account.password = password;
      write(STORAGE.users, users);
      toast('Password updated. You can now log in.');
      setTimeout(() => (location.href = './login.html'), 450);
    }
  });
})();
