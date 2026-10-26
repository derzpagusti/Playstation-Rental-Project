(function () {
  const { bookingCatalog, money, escapeHtml } = window.NovaPS;
  const container = document.querySelector('[data-unit-list]');
  if (!container) return;

  container.innerHTML = ['PS4', 'PS5']
    .map((category) => {
      const unit = bookingCatalog()[category];
      const features = unit.features
        .map((feature) => `<li>${escapeHtml(feature)}</li>`)
        .join('');
      const games = unit.games
        .map((game) => `<li>${escapeHtml(game)}</li>`)
        .join('');

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
          <section class="game-list-box">
            <h4>See all game</h4>
            <ol>${games}</ol>
          </section>
          <a class="btn btn-purple unit-choose" href="./booking.html?category=${category}">
            Choose &amp; Rent
          </a>
        </article>
      `;
    })
    .join('');
})();
