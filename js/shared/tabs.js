/*
 * Shared tab behaviour (Time Remaining and Order Status pages).
 *
 *   NovaPS.initTabs(tablist, onChange)
 *
 * Tabs are [role="tab"] buttons with data-tab="<key>". onChange(key) runs
 * whenever the selected tab changes. Supports arrow keys, Home and End.
 */
NovaPS.initTabs = function (tablist, onChange) {
  var tabs = [].slice.call(tablist.querySelectorAll('[role="tab"]'));

  function select(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    if (focus) tab.focus();
    onChange(tab.dataset.tab);
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () {
      select(tab, false);
    });
    tab.addEventListener("keydown", function (e) {
      var next = null;
      if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
      if (e.key === "ArrowLeft")
        next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === "Home") next = tabs[0];
      if (e.key === "End") next = tabs[tabs.length - 1];
      if (next) {
        e.preventDefault();
        select(next, true);
      }
    });
  });
};
