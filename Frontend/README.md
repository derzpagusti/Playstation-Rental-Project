# NovaPS Frontend Demo

Static HTML, CSS, and JavaScript pages for the NovaPS PlayStation rental prototype. The frontend runs without the backend and saves demo accounts and orders in this browser localStorage.

## Open in VS Code

Open the Frontend folder in VS Code and start index.html with Live Server. The HTML files can also be opened directly in a browser.

## Pages

- index.html — Home page.
- login.html — Demo login; any valid email and non-empty password are accepted.
- signup.html — Demo registration with password checks and ID image selection.
- change-password.html — Change a locally registered demo account password.
- units.html — PS4 and PS5 prices, availability, and game lists.
- booking.html — Customer info, ID card selection, one or two rental units, durations, notes, and checkout.
- payment-confirmation.html — Demo QRIS screen, order summary, timer, and payment submission.
- confirmation.html — Payment-received summary with links to Home and Booking Status.
- booking-status.html — Empty state or locally saved booking cards and details.
- account-info.html — View demo account details.
- account-edit.html — Edit and save profile details in browser storage.

## Code organization

- assets/css/shared.css holds shared styling.
- assets/css/<page>.css contains page-specific styles.
- assets/js/common.js holds shared storage helpers and the unit catalog.
- assets/js/<page>.js contains page-specific behavior.

The booking flow is booking.html → payment-confirmation.html → confirmation.html → booking-status.html. Every page imports shared assets and its own CSS and JavaScript. The older src/app.js and src/styles.css files are not loaded by the separate pages.

## Demo limits

There is no backend authentication, file upload, or payment processing. The QRIS graphic is decorative, and proof images are not uploaded; the demo stores selected file names only.
