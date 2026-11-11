/*
 * Shared on every page: login state, saved profile and the users list
 * (the admin "Users" page reads it, and can block users).
 * DEMO ONLY - everything lives in localStorage. Replace with a real
 * backend/API session later.
 *
 * Protect a page by adding data-require-login="<login url>" to this script tag.
 */
(function () {
  var SESSION_KEY = "novaps_user";
  var PROFILE_KEY = "novaps_profile";
  var USERS_KEY = "novaps_users";
  var PROFILE_FIELDS = ["fullname", "phone", "address", "idcard"];

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

  function emailKey(email) {
    return (email || "").toLowerCase();
  }

  /* ---------- users list (every account that signed up / logged in) ---------- */

  function usersMap() {
    return read(USERS_KEY) || {};
  }

  // Copy only the fields that are really set, so nothing gets erased by accident
  function pick(source) {
    var out = {};
    PROFILE_FIELDS.forEach(function (key) {
      if (source && source[key]) out[key] = source[key];
    });
    return out;
  }

  var users = {
    all: function () {
      var map = usersMap();
      return Object.keys(map)
        .map(function (k) {
          return map[k];
        })
        .sort(function (a, b) {
          return (b.joinedAt || "").localeCompare(a.joinedAt || "");
        });
    },
    get: function (email) {
      return usersMap()[emailKey(email)] || null;
    },
    upsert: function (email, patch) {
      var map = usersMap();
      var key = emailKey(email);
      var user = map[key] || {
        email: email,
        joinedAt: new Date().toISOString(),
        blocked: false,
      };
      Object.assign(user, patch, { email: email });
      map[key] = user;
      write(USERS_KEY, map);
      return user;
    },
    rename: function (oldEmail, newEmail) {
      var map = usersMap();
      var old = emailKey(oldEmail);
      if (!map[old] || old === emailKey(newEmail)) return;
      map[emailKey(newEmail)] = Object.assign(map[old], { email: newEmail });
      delete map[old];
      write(USERS_KEY, map);
    },
    isBlocked: function (email) {
      var user = usersMap()[emailKey(email)];
      return !!(user && user.blocked);
    },
    setBlocked: function (email, blocked, reason) {
      return users.upsert(email, {
        blocked: blocked,
        blockedAt: blocked ? new Date().toISOString() : null,
        blockReason: blocked ? reason || "" : "",
      });
    },
  };

  /* ---------- session + profile ---------- */

  window.NovaPS = {
    users: users,

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
      users.upsert(
        email,
        Object.assign(
          { lastLoginAt: new Date().toISOString() },
          pick(read(PROFILE_KEY)),
        ),
      );
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
        var session = read(SESSION_KEY);
        write(PROFILE_KEY, Object.assign({}, read(PROFILE_KEY) || {}, patch));
        if (patch.email) {
          if (session) users.rename(session.email, patch.email);
          write(SESSION_KEY, { email: patch.email });
        }
        var current = read(SESSION_KEY);
        if (current) users.upsert(current.email, pick(patch));
      },
    },
  };

  // A blocked user is logged out on the next page load
  var session = read(SESSION_KEY);
  var blocked = !!session && users.isBlocked(session.email);
  if (blocked) NovaPS.logout();

  // Accounts that existed before the users list was added
  if (session && !blocked && !users.get(session.email)) {
    users.upsert(session.email, pick(read(PROFILE_KEY)));
  }

  // Runs in <head> so the page never flashes the wrong state.
  // Tailwind's custom "logged-in:" variant reacts to this class.
  if (NovaPS.isLoggedIn()) {
    document.documentElement.classList.add("logged-in");
  }

  // Protected pages: send guests to the login page before anything renders.
  var loginUrl =
    document.currentScript && document.currentScript.dataset.requireLogin;
  if (loginUrl && !NovaPS.isLoggedIn()) {
    location.replace(loginUrl + (blocked ? "?blocked=1" : ""));
  }
})();
