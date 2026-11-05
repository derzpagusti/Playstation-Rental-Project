/*
 * Shared on every page: login state + saved profile.
 * DEMO ONLY - everything lives in localStorage. Replace with a real
 * backend/API session later.
 *
 * Protect a page by adding data-require-login="<login url>" to this script tag.
 */
(function () {
  var SESSION_KEY = "novaps_user";
  var PROFILE_KEY = "novaps_profile";

  function read(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (e) {
      return null;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  window.NovaPS = {
    isLoggedIn: function () {
      return !!read(SESSION_KEY);
    },

    // profile (optional) = data collected at sign up
    login: function (email, profile) {
      write(SESSION_KEY, { email: email });
      var saved = read(PROFILE_KEY);
      if (profile) {
        write(PROFILE_KEY, profile);
      } else if (!saved || saved.email !== email) {
        write(PROFILE_KEY, { email: email });
      }
    },

    logout: function () {
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch (e) {}
    },

    profile: {
      get: function () {
        var profile = read(PROFILE_KEY) || {};
        var session = read(SESSION_KEY);
        if (!profile.email && session) profile.email = session.email;
        return profile;
      },
      set: function (patch) {
        write(PROFILE_KEY, Object.assign({}, read(PROFILE_KEY) || {}, patch));
        if (patch.email) write(SESSION_KEY, { email: patch.email });
      },
    },
  };

  // Runs in <head> so the page never flashes the wrong state.
  // Tailwind's custom "logged-in:" variant reacts to this class.
  if (NovaPS.isLoggedIn()) {
    document.documentElement.classList.add("logged-in");
  }

  // Protected pages: send guests to the login page before anything renders.
  var loginUrl =
    document.currentScript && document.currentScript.dataset.requireLogin;
  if (loginUrl && !NovaPS.isLoggedIn()) {
    location.replace(loginUrl);
  }
})();
