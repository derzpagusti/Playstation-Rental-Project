const app = document.getElementById('app');
const DB = {users: 'novaps_users', session: 'novaps_session', units: 'novaps_units', bookings: 'novaps_bookings'};
const DEFAULT_UNITS = [
    {id: 'PS3-01', name: 'PS3 Playbox 01', category: 'PS3', model: 'PlayBox', booth: 'A1', status: 'Available'},
    {id: 'PS3-02', name: 'PS3 Playbox 02', category: 'PS3', model: 'PlayBox', booth: 'A2', status: 'Available'},
    {id: 'PS4-01', name: 'PS4 Playbox 01', category: 'PS4', model: 'PlayBox', booth: 'B1', status: 'Available'},
    {id: 'PS4-02', name: 'PS4 Playbox 02', category: 'PS4', model: 'PlayBox', booth: 'B2', status: 'Available'}
];
const PRICES = {PS3: {6: 36000, 12: 72000, 24: 120000}, PS4: {6: 45000, 12: 96000, 24: 156000}};
const read = (key, fallback) => {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value === null ? fallback : value
    } catch {
        return fallback
    }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
let units = read(DB.units, DEFAULT_UNITS), bookings = read(DB.bookings, []), route = 'home';
const user = () => read(DB.session, null),
    money = value => 'Rp ' + new Intl.NumberFormat('id-ID').format(Number(value) || 0),
    esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800)
}

function navigate(value) {
    location.hash = value.startsWith('#') ? value : '#' + value
}

function brand() {
    return '<a class="brand" href="#home" data-route="home"><span class="brand-mark"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="M7 12h5M9.5 9.5v5M16.5 10.5h.01M18.5 13h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span><span>Nova<span class="brand-accent">PS</span></span></a>'
}

function header() {
    let logged = !!user();
    let links = route === 'login' ? '<a href="#home" data-route="home">Home</a>' : route === 'signup' ? '<a href="#home" data-route="home">Home</a>' : '<a href="#home" data-route="home">Home</a><a href="#units" data-route="units">Unit</a><a href="#booking-status" data-route="booking-status">Booking Status</a>';
    let actions = route === 'login' ? '<a class="btn btn-outline" href="#signup" data-route="signup">Sign Up</a>' : route === 'signup' ? '<a class="btn btn-outline" href="#login" data-route="login">Login</a>' : logged ? '<a class="btn btn-outline hide-small" href="#booking-status" data-route="booking-status">My Orders</a><button class="btn btn-cyan" data-action="logout">Log Out</button>' : '<a class="btn btn-outline" href="#login" data-route="login">Login</a><a class="btn btn-cyan" href="#booking" data-route="booking">Order Now</a>';
    return '<header class="site-header"><div class="nav-wrap">' + brand() + '<nav class="main-nav">' + links + '</nav><div class="nav-actions">' + actions + '</div></div></header>'
}

function footer() {
    return '<footer class="footer"><div class="footer-inner"><div><h3>NovaPS</h3><p>PlayStation rental for game nights, hangouts, and friendly competition. Pick your console and enjoy the game.</p></div><div><h3>Quick Link</h3><a href="#home" data-route="home">Home</a><a href="#units" data-route="units">Unit</a><a href="#booking-status" data-route="booking-status">Booking Status</a></div><div><h3>Contact Us</h3><p>WhatsApp: +62 812-3347-1034<br>Time: 10:00 a.m. – 10:00 p.m.</p></div><div class="copyright">© 2026 NovaPS Rental. All rights reserved.</div></div></footer>'
}

const icons = ['<svg class="benefit-icon" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="1.6"/><path d="M16 8v8l5 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>', '<svg class="benefit-icon" viewBox="0 0 32 32" fill="none"><path d="m12 12-5-5m13 13 5 5m0-18-5 5m-8 8-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="12" y="3" width="8" height="8" rx="2" stroke="currentColor"/><rect x="21" y="12" width="8" height="8" rx="2" stroke="currentColor"/><rect x="12" y="21" width="8" height="8" rx="2" stroke="currentColor"/><rect x="3" y="12" width="8" height="8" rx="2" stroke="currentColor"/></svg>', '<svg class="benefit-icon" viewBox="0 0 32 32" fill="none"><circle cx="9" cy="24" r="3" stroke="currentColor"/><circle cx="24" cy="24" r="3" stroke="currentColor"/><path d="m9 24 5-9h7l3 9M14 15l-3-5h-4m6 5 5 5h6M20 10h4l3 8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>', '<svg class="benefit-icon" viewBox="0 0 32 32" fill="none"><rect x="4" y="4" width="9" height="9" rx="1" stroke="currentColor" stroke-width="1.6"/><rect x="19" y="4" width="9" height="9" rx="1" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="19" width="9" height="9" rx="1" stroke="currentColor" stroke-width="1.6"/><path d="M21 19h2v2h-2zm5 0h2v2h-2zm-5 5h2v2h-2zm5 4h2m-5-1v2" stroke="currentColor"/></svg>'];

function homePage() {
    let cards = [['PS3', '36.000', 'PS3 PlayBox console + 2 controllers', 'Classic games and local co-op'], ['PS4', '45.000', 'PS4 PlayBox console + 2 controllers', 'HDMI cable and game collection']];
    return '<main><section class="hero"><div class="hero-inner"><h1>Rent your PS now,<br>And Enjoy the Game!</h1><p>NovaPS is a PlayStation rental shop offering PS3 and PS4 consoles with a large selection of games you can play with friends.</p><div class="hero-actions"><a class="btn btn-cyan btn-large" href="#booking" data-route="booking">Order Now</a><a class="btn btn-outline btn-large" href="#how-to-order" data-scroll="how-to-order">How to order</a></div></div></section><section class="benefits"><div class="section-inner"><h2 class="section-title">Why choose us?</h2><div class="benefit-grid">' + ['Booking 24/7', 'A large collection<br>of games', 'Free Shipping', 'Payment via QRIS'].map((label, i) => '<article class="benefit-card">' + icons[i] + '<strong>' + label + '</strong></article>').join('') + '</div></div></section><section id="how-to-order" class="how-section"><div class="section-inner"><h2 class="section-title">3 Easy Step Order</h2><div class="steps"><div><span class="step-num">1</span><div class="step-text">Select a Unit<br>&amp; Schedule</div></div><div class="step-arrow">⟶</div><div><span class="step-num">2</span><div class="step-text">Fill the Form &amp; Pay</div></div><div class="step-arrow">⟶</div><div><span class="step-num">3</span><div class="step-text">Your PS will be<br>delivered</div></div></div></div></section><section class="units-section"><div class="section-inner"><h2 class="section-title units-title">Unit Options &amp; Prices</h2><p class="units-subtitle">Choose a PlayBox and rental duration. Final pricing is shown before you book.</p><div class="unit-grid">' + cards.map(c => '<article class="unit-card"><h3>' + c[0] + '</h3><p class="unit-price">Rp ' + c[1] + '<small>/ 6 hours</small></p><ul><li>' + c[2] + '</li><li>' + c[3] + '</li><li>Choose 6, 12 or 24 hours</li></ul><a class="btn btn-purple" href="#booking?category=' + c[0] + '" data-route="booking?category=' + c[0] + '">Choose &amp; Rent</a></article>').join('') + '</div></div></section><section class="cta"><div class="section-inner"><h2>Ready to play? Book Now!</h2><a href="#booking" data-route="booking" class="btn btn-white">Order Now</a></div></section></main>'
}

function authPage(signup) {
    let fields = signup ? '<label class="form-field">Full name<input name="name" required autocomplete="name"></label><label class="form-field">Email<input name="email" type="email" required autocomplete="email"></label><label class="form-field">Phone number<input name="phone" type="tel" required placeholder="08xxxxxxxxxx" autocomplete="tel"></label><label class="form-field">Password<input name="password" type="password" required autocomplete="new-password"></label>' : '<label class="form-field">Email<input name="email" type="email" required autocomplete="email"></label><label class="form-field">Password<input name="password" type="password" required autocomplete="current-password"></label>';
    return '<main class="auth-main"><section class="auth-card"><h1>' + (signup ? 'Sign Up' : 'Login') + '</h1><p class="auth-subtitle">' + (signup ? 'Create an account to rent and track your order status.' : 'Log in to rent and track your order status') + '</p><form data-form="' + (signup ? 'signup' : 'login') + '">' + fields + '<p class="form-error" aria-live="polite"></p><button class="auth-submit">' + (signup ? 'Sign Up' : 'Login') + '</button></form><p class="auth-foot">' + (signup ? 'Already have an account? <a class="text-link" href="#login" data-route="login">Login</a>' : 'Doesn’t have account? <a class="text-link" href="#signup" data-route="signup">Sign Up</a>') + '</p></section></main>'
}

function unitPage() {
    return '<main class="page-main"><div class="page-wrap"><h1 class="page-heading">Unit Options &amp; Prices</h1><p class="page-lead">Choose an available PlayBox, pick your rental hours, and book online.</p><div class="unit-grid">' + units.map(u => '<article class="unit-card"><div class="flex-between"><h3>' + esc(u.name) + '</h3><span class="unit-status ' + (u.status === 'Available' ? '' : 'busy') + '">' + esc(u.status) + '</span></div><p class="unit-price">' + money(PRICES[u.category][6]) + '<small>/ 6 hours</small></p><ul><li>' + u.category + ' PlayBox · Booth ' + u.booth + '</li><li>2 controllers included</li><li>6, 12 or 24-hour options</li></ul><a class="btn ' + (u.status === 'Available' ? 'btn-purple' : 'btn-disabled') + '" ' + (u.status === 'Available' ? 'href="#booking?unit=' + u.id + '" data-route="booking?unit=' + u.id + '"' : 'aria-disabled="true"') + '>' + (u.status === 'Available' ? 'Choose &amp; Rent' : 'Unavailable') + '</a></article>').join('') + '</div></div></main>'
}

function bookingPage() {
    let p = new URLSearchParams(location.hash.split('?')[1] || ''), category = p.get('category'), unit = p.get('unit'),
        choices = units.filter(u => u.status === 'Available' && (!category || u.category === category));
    let options = choices.map(u => '<option value="' + u.id + '" ' + (unit === u.id ? 'selected' : '') + '>' + u.name + ' · Booth ' + u.booth + '</option>').join('');
    return '<main class="page-main"><div class="page-wrap"><h1 class="page-heading">Book your PlayBox</h1><p class="page-lead">Choose your unit and schedule. This demo saves your booking in this browser.</p><section class="panel"><form data-form="booking" class="booking-form"><label class="form-field wide">Choose unit<select name="unit" required ' + (choices.length ? '' : 'disabled') + '>' + options + '</select></label><label class="form-field">Full name<input required name="name" value="' + esc(user()?.name || '') + '" autocomplete="name"></label><label class="form-field">Phone number<input required name="phone" value="' + esc(user()?.phone || '') + '" placeholder="08xxxxxxxxxx" autocomplete="tel"></label><label class="form-field">Start date &amp; time<input required type="datetime-local" name="start" min="' + new Date().toISOString().slice(0, 16) + '" value="' + new Date(Date.now() + 3600000).toISOString().slice(0, 16) + '"></label><label class="form-field">Duration<select name="hours"><option value="6">6 hours</option><option value="12">12 hours</option><option value="24">24 hours</option></select></label><label class="form-field wide">Payment method<select name="payment"><option>QRIS</option><option>Transfer Bank</option><option>Cash</option></select></label><label class="form-field wide">Payment proof (optional)<input name="proof" type="file" accept="image/png,image/jpeg"><span class="hint">Demo only. The selected file is not uploaded.</span></label><div class="price-preview wide"><span>Estimated total</span><strong data-price>—</strong></div><p class="form-error wide" aria-live="polite"></p><button class="btn btn-purple btn-large wide" ' + (choices.length ? '' : 'disabled') + '>' + (choices.length ? 'Confirm Booking' : 'No available units') + '</button><p class="hint wide">Demo only: no payment is processed. Booking data stays in this browser.</p></form></section></div></main>'
}

function bookingRow(b) {
    return '<article class="booking-row"><div><strong>' + esc(b.unitName) + ' · ' + b.hours + ' hours</strong><p>Code ' + esc(b.code) + ' · ' + new Date(b.start).toLocaleString('en-ID') + ' · ' + money(b.total) + '</p></div><span class="unit-status">' + esc(b.status) + '</span></article>'
}

function statusPage() {
    let mine = user() ? bookings.filter(b => b.email === user().email) : [];
    return '<main class="page-main"><div class="page-wrap"><h1 class="page-heading">Booking Status</h1><p class="page-lead">Enter the booking code and phone number from your reservation.</p><section class="panel"><form data-form="track" class="booking-form"><label class="form-field">Booking code<input name="code" required placeholder="NPS-123456"></label><label class="form-field">Phone number<input name="phone" required placeholder="08xxxxxxxxxx"></label><button class="btn btn-purple wide">Check booking</button><p class="form-error wide" aria-live="polite"></p></form><div id="track-result"></div></section>' + (user() ? '<h2 class="section-title" style="text-align:center;margin:42px 0 18px">My recent bookings</h2><div class="booking-list">' + (mine.length ? mine.map(bookingRow).join('') : '<div class="empty-state">Your bookings will appear here.</div>') + '</div>' : '') + '</div></main>'
}

function render() {
    route = (location.hash.slice(1) || 'home').split('?')[0];
    let content = route === 'login' ? authPage(false) : route === 'signup' ? authPage(true) : route === 'units' ? unitPage() : route === 'booking' ? bookingPage() : route === 'booking-status' ? statusPage() : homePage();
    app.innerHTML = header() + content + footer();
    if (route === 'booking') updateBookingPrice()
}

function updateBookingPrice() {
    let form = document.querySelector('[data-form="booking"]');
    if (!form) return;
    let data = new FormData(form), unit = units.find(x => x.id === data.get('unit')), hours = Number(data.get('hours')),
        el = form.querySelector('[data-price]');
    if (el) el.textContent = unit ? money(PRICES[unit.category][hours]) : '—'
}

function error(form, message) {
    let box = form.querySelector('.form-error');
    if (box) box.textContent = message; else showToast(message)
}

function handleAuth(form, signup) {
    let data = Object.fromEntries(new FormData(form)), users = read(DB.users, []);
    if (signup) {
        if (users.some(x => x.email.toLowerCase() === data.email.toLowerCase())) return error(form, 'An account with this email already exists.');
        let next = {
            name: data.name.trim(),
            email: data.email.trim().toLowerCase(),
            phone: data.phone.trim(),
            password: data.password
        };
        users.push(next);
        write(DB.users, users);
        write(DB.session, {name: next.name, email: next.email, phone: next.phone});
        showToast('Account created. Welcome to NovaPS!')
    } else {
        if (!data.email || !data.password) return error(form, 'Enter an email and password.');
        let match = users.find(x => x.email.toLowerCase() === data.email.trim().toLowerCase()),
            account = match || {name: data.email.split('@')[0], email: data.email.trim().toLowerCase(), phone: ''};
        if (!match) {
            users.push({...account, password: data.password});
            write(DB.users, users)
        }
        write(DB.session, {name: account.name, email: account.email, phone: account.phone || ''});
        showToast('You are logged in. Demo accepts any email and password.')
    }
    navigate('home')
}

function handleBooking(form) {
    let data = Object.fromEntries(new FormData(form)), unit = units.find(x => x.id === data.unit);
    if (!unit || unit.status !== 'Available') return error(form, 'That unit is no longer available. Choose another.');
    if (data.proof?.size > 2097152 || data.proof?.size && !['image/jpeg', 'image/png'].includes(data.proof.type)) return error(form, 'Payment proof must be a JPG or PNG no larger than 2 MB.');
    if (!data.start || new Date(data.start) < new Date()) return error(form, 'Choose a start time in the future.');
    let booking = {
        code: 'NPS-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        unitId: unit.id,
        unitName: unit.name,
        category: unit.category,
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: user()?.email || '',
        hours: Number(data.hours),
        start: data.start,
        payment: data.payment,
        proofName: data.proof?.name || '',
        total: PRICES[unit.category][Number(data.hours)],
        status: 'Booked',
        created: new Date().toISOString()
    };
    bookings.unshift(booking);
    write(DB.bookings, bookings);
    unit.status = 'Booked';
    write(DB.units, units);
    render();
    document.querySelector('.page-wrap').innerHTML = '<div class="success-box"><p class="eyebrow" style="justify-content:center">BOOKING REQUESTED</p><h1 class="page-heading" style="margin-top:10px">You’re all set!</h1><p class="page-lead">Save this booking code to check your order status.</p><p class="success-code">' + esc(booking.code) + '</p><p>' + esc(booking.unitName) + ' · ' + booking.hours + ' hours · ' + money(booking.total) + '</p><div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:22px"><button class="btn btn-purple" data-action="copy-code" data-code="' + booking.code + '">Copy booking code</button><a class="btn btn-outline" style="color:#283247;border-color:#aeb8c7" href="#booking-status" data-route="booking-status">Track booking</a><a class="btn btn-cyan" href="#home" data-route="home">Back home</a></div></div>';
    showToast('Booking saved in this browser.')
}

function track(form) {
    let data = Object.fromEntries(new FormData(form)),
        booking = bookings.find(b => b.code.toUpperCase() === data.code.trim().toUpperCase() && b.phone.replace(/\s/g, '') === data.phone.replace(/\s/g, '')),
        target = document.getElementById('track-result');
    if (!booking) {
        error(form, 'No booking matches that code and phone number.');
        target.innerHTML = '';
        return
    }
    form.querySelector('.form-error').textContent = '';
    target.innerHTML = '<article class="booking-row" style="margin-top:20px"><div><small>BOOKING ' + esc(booking.code) + '</small><h2 style="margin:6px 0">' + esc(booking.unitName) + ' · ' + booking.hours + ' hours</h2><p>' + new Date(booking.start).toLocaleString('en-ID') + ' · ' + money(booking.total) + ' · ' + esc(booking.payment) + '</p></div><span class="unit-status">' + esc(booking.status) + '</span></article>'
}

document.addEventListener('click', e => {
    let r = e.target.closest('[data-route]');
    if (r) {
        e.preventDefault();
        navigate(r.dataset.route);
        return
    }
    let scroll = e.target.closest('[data-scroll]');
    if (scroll) {
        e.preventDefault();
        document.getElementById(scroll.dataset.scroll)?.scrollIntoView({behavior: 'smooth'});
        return
    }
    let act = e.target.closest('[data-action]');
    if (!act) return;
    if (act.dataset.action === 'logout') {
        localStorage.removeItem(DB.session);
        render();
        showToast('You have logged out.')
    }
    if (act.dataset.action === 'copy-code') {
        navigator.clipboard?.writeText(act.dataset.code).then(() => showToast('Booking code copied.')).catch(() => showToast('Booking code: ' + act.dataset.code))
    }
});
document.addEventListener('submit', e => {
    let form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    if (form.dataset.form === 'login') handleAuth(form, false);
    if (form.dataset.form === 'signup') handleAuth(form, true);
    if (form.dataset.form === 'booking') handleBooking(form);
    if (form.dataset.form === 'track') track(form)
});
document.addEventListener('change', e => {
    if (e.target.closest('[data-form="booking"]')) updateBookingPrice()
});
window.addEventListener('hashchange', render);
render();
