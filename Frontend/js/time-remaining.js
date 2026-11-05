/* Time Remaining page. Requires js/shared/session.js and js/shared/tabs.js. */
(function () {
  // There is no order data yet (no backend), so every tab shows an empty state.
  var messages = {
    all: "You haven’t ordered anything yet",
    "4-hours": "No rentals ending within 4 hours.",
    "1-hour": "No rentals ending within 1 hour.",
    overdue: "No overdue rentals.",
    returned: "No returned rentals yet.",
  };

  var message = document.getElementById("empty-message");
  var cta = document.getElementById("empty-cta");

  NovaPS.initTabs(document.getElementById("tabs"), function (key) {
    message.textContent = messages[key];
    cta.hidden = key !== "all"; // "Order Now" only on the first tab
  });
})();
