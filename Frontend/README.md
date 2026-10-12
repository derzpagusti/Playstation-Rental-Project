# NovaPS Frontend Demo

A standalone HTML, CSS and JavaScript prototype styled to match the supplied NovaPS home and login references. The interface works without the backend.

## Run

Open `Frontend/index.html` in VS Code and use Live Server, or open the file in a browser. Tailwind CSS is available from its browser CDN; the custom page styling is in `src/styles.css` and all interactions are in `src/app.js`.

## Demo pages

- Home landing page with benefit cards, three ordering steps, unit prices and booking calls to action.
- Login and sign-up pages. Login accepts any valid email and non-empty password; no server authentication is used.
- Unit list, booking form, confirmation with booking code, and booking status lookup by code and phone.
- PS3 / PS4 units and 6, 12, or 24-hour rental durations.

Demo accounts, bookings, and unit availability are saved in this browser using `localStorage`. A payment proof file may be selected, but is not uploaded or processed. Reset the demo by clearing site data for the local page.
