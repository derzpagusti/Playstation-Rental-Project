(function () {
  const { bookingCatalog, money, escapeHtml } = window.NovaPS;

  function renderUnitCard(category, preview = false) {
    const unit = bookingCatalog()[category];
    const features = unit.features
      .map((feature) => `<li>${escapeHtml(feature)}</li>`)
      .join('');
    const games = unit.games
      .map((game) => `<li>${escapeHtml(game)}</li>`)
      .join('');

    const gameList = preview
      ? `
        <button class="games-mini" type="button" data-games="${category}">
          See all game
        </button>
        <ol class="preview-games hidden" id="preview-${category}">${games}</ol>
      `
      : `
        <section class="game-list-box">
          <h4>See all game</h4>
          <ol>${games}</ol>
        </section>
      `;

    return `
      <article class="unit-card ${category === 'PS5' ? 'featured' : ''}">
        <div class="unit-card-head">
          <h3>${category}</h3>
          <span class="availability-count ${unit.available < 5 ? 'low' : ''}">
            Available: ${unit.available}
          </span>
        </div>
        <p class="unit-price">${money(unit.daily)}<small>/day</small></p>
        <ul class="unit-features">${features}</ul>
        ${gameList}
        <a class="btn btn-purple unit-choose" href="./booking.html?category=${category}">
          Choose &amp; Rent
        </a>
      </article>
    `;
  }

  document.querySelectorAll('[data-unit-preview]').forEach((element) => {
    element.innerHTML = ['PS4', 'PS5']
      .map((category) => renderUnitCard(category, true))
      .join('');
  });

  document.querySelectorAll('[data-unit-list]').forEach((element) => {
    element.innerHTML = ['PS4', 'PS5']
      .map((category) => renderUnitCard(category))
      .join('');
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-games]');
    if (!button) return;

    const list = document.getElementById(`preview-${button.dataset.games}`);
    if (!list) return;

    list.classList.toggle('hidden');
    button.textContent = list.classList.contains('hidden') ? 'See all game' : 'Hide games';
  });
})();
