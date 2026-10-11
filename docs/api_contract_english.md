# API Contract — PSManagement

Contract between the backend (native PHP) and frontend. **If there are changes to endpoints, requests, or responses, update this document first and then notify the group before merging.**

## 1. General Conventions

| Item | Rule |
|---|---|
| Base URL (local) | `http://psmanagement.test/api` (adjust with Laragon virtual host) |
| Data format | JSON (`Content-Type: application/json`), except file upload endpoints which use `multipart/form-data` |
| Field naming | `snake_case`, matching the database column names exactly |
| Currency | Unformatted whole numbers for Rupiah, e.g., `25000` (the frontend will format it as "Rp 25.000") |
| Date and time | `YYYY-MM-DDTHH:MM:SS` in WIB without offset, e.g., `2026-10-08T14:00:00` |
| Admin auth | Header `Authorization: Bearer <token>` |
| Customer auth | No login required. Orders are accessed using `booking_code` + `phone` |
| CORS | The backend allows frontend origins (Live Server / virtual host) |

### Response Formats

Success:

```json
{ "success": true, "data": { } }
```

Success with pagination:

```json
{ "success": true, "data": [ ], "meta": { "page": 1, "per_page": 20, "total": 57 } }
```

Failed:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Invalid data",
  "errors": { "duration_hours": "Minimum duration is 1 hour" }
}
```

The `errors` field only appears on `VALIDATION_ERROR`. The frontend displays the `message` to the user and uses the `code` for logic.

### Status Codes and Error Codes

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | The body is not a valid JSON |
| 401 | `UNAUTHORIZED` | Admin token is missing, incorrect, or expired |
| 401 | `INVALID_CREDENTIALS` | Admin username or password is incorrect |
| 403 | `FORBIDDEN` | The role is not authorized (e.g., an `admin` accessing an `owner` specific feature) |
| 404 | `NOT_FOUND` | Data is not found, including incorrect `booking_code` + `phone` combinations |
| 409 | `SLOT_TAKEN` | The device is already booked for that time range |
| 409 | `DEVICE_MAINTENANCE` | The device is currently under maintenance |
| 409 | `DEVICE_OVERDUE` | The device has not been returned by the previous renter |
| 409 | `INVALID_STATUS_TRANSITION` | Invalid status change (e.g., verifying a booking that is already `Rented`) |
| 413 | `FILE_TOO_LARGE` | The uploaded file exceeds the limit (max 2 MB) |
| 422 | `VALIDATION_ERROR` | The input failed validation |
| 429 | `BOOKING_LIMIT_REACHED` | The phone number already has 2 active bookings |
| 500 | `SERVER_ERROR` | Server error |

### Enums

| Name | Values |
|---|---|
| `rental_status` | `Booked`, `Rented`, `Overdue`, `Returned` |
| `payment_method` | `QRIS`, `Transfer Bank`, `Cash` |
| `booking_channel` | `Online`, `Walk-in`, `WhatsApp` |
| `category` | `PS3`, `PS4` |
| `identity_doc_type` | `Kartu Pelajar` (Student ID), `KTP` (National ID), `SIM` (Driver's License) |
| `device.status` (admin) | `Available`, `Maintenance` |
| `availability` (public) | `available` (green), `rented` (red), `maintenance` (gray) |

### File Upload Rules

| Type | Format | Max Size |
|---|---|---|
| Payment proof | JPG, PNG | 2 MB |
| Identity document | JPG, PNG | 2 MB |

Files are stored outside of `public/`, so there is no direct URL. Admins retrieve them via specific endpoints (see section 3.8).

---

## 2. Public Endpoints (Customer, no login)

### 2.1 Device list and availability status

`GET /api/devices`

Used on the main page. **The frontend recalls this every 5 seconds (polling)** to update the green/red indicators without reloading.

```json
{
  "success": true,
  "data": [
    {
      "device_id": 1,
      "device_name": "PS3 Playbox 01",
      "category": "PS3",
      "booth_code": "A1",
      "availability": "available",
      "rented_until": null
    },
    {
      "device_id": 3,
      "device_name": "PS4 Playbox 01",
      "category": "PS4",
      "booth_code": "B1",
      "availability": "rented",
      "rented_until": "2026-10-08T17:00:00"
    }
  ]
}
```

`availability` will be `rented` if there is a rental with a `Booked`, `Rented`, or `Overdue` status whose time range includes the current time.

### 2.2 Available devices for a specific time range

`GET /api/devices/available?start_time=2026-10-08T14:00:00&duration_hours=3`

| Query | Required | Description |
|---|---|---|
| `start_time` | Yes | Rental start time |
| `duration_hours` | Yes | Integer ≥ 1 |
| `category` | No | `PS3` or `PS4` |

Response: an array containing `device_id`, `device_name`, `category`, and `booth_code`.

### 2.3 Pricing and packages for a device

`GET /api/devices/{device_id}/pricing`

```json
{
  "success": true,
  "data": {
    "device_id": 3,
    "tiers": [
      { "min_hours": 1, "price_per_hour": 10000 },
      { "min_hours": 12, "price_per_hour": 8000 },
      { "min_hours": 24, "price_per_hour": 6500 }
    ],
    "packages": [
      { "package_id": 2, "package_name": "3 Hour Promo Package", "duration_hours": 3, "package_price": 25000 }
    ]
  }
}
```

Only packages with `is_active = true` are sent.

### 2.4 Calculate price (preview)

`POST /api/pricing/calculate`

Send **either**: `duration_hours` or `package_id`.

```json
{ "device_id": 3, "duration_hours": 5 }
```

```json
{
  "success": true,
  "data": {
    "duration_hours": 5,
    "price_per_hour": 10000,
    "total_cost": 50000,
    "package_id": null
  }
}
```

The frontend may calculate this on its own for an instant display, but **the official number is always from the server when the booking is created**.

### 2.5 Create a booking

`POST /api/bookings` (`multipart/form-data`)

| Field | Required | Description |
|---|---|---|
| `full_name` | Yes | Max 100 characters |
| `phone` | Yes | Format `08xxxxxxxxxx`, 10–15 digits |
| `email` | No | Valid email format |
| `device_id` | Yes | |
| `start_time` | Yes | Must be in the future or present |
| `duration_hours` | Either one | Integer ≥ 1, without `package_id` |
| `package_id` | Either one | Without `duration_hours` |
| `payment_method` | Yes | Enum `payment_method` |
| `booking_channel` | No | Default is `Online` |
| `identity_doc_type` | Conditional | Required if the customer doesn't have a saved document |
| `identity_doc` | Conditional | File, required if the customer doesn't have a saved document |

Response `201`:

```json
{
  "success": true,
  "data": {
    "rental_id": 12,
    "booking_code": "A3F9B2C1",
    "device_name": "PS4 Playbox 01",
    "start_time": "2026-10-08T14:00:00",
    "end_time": "2026-10-08T17:00:00",
    "duration_hours": 3,
    "price_per_hour": null,
    "total_cost": 25000,
    "rental_status": "Booked",
    "payment_method": "QRIS"
  }
}
```

Possible errors: `VALIDATION_ERROR`, `SLOT_TAKEN`, `DEVICE_MAINTENANCE`, `DEVICE_OVERDUE`, `BOOKING_LIMIT_REACHED`.

The frontend must clearly display the `booking_code` and instruct the customer to save it, as it is the only way to track the order.

### 2.6 Upload payment proof

`POST /api/bookings/{booking_code}/payment-proof` (`multipart/form-data`)

| Field | Required | Description |
|---|---|---|
| `phone` | Yes | Must match the phone number of the booking owner |
| `payment_proof` | Yes | Image file |

```json
{ "success": true, "data": { "booking_code": "A3F9B2C1", "payment_proof_uploaded": true } }
```

### 2.7 Track order

`POST /api/bookings/track`

Uses `POST` so the phone number does not appear in the URL or server logs.

```json
{ "booking_code": "A3F9B2C1", "phone": "081234567890" }
```

```json
{
  "success": true,
  "data": {
    "booking_code": "A3F9B2C1",
    "device_name": "PS4 Playbox 01",
    "start_time": "2026-10-08T14:00:00",
    "end_time": "2026-10-08T17:00:00",
    "duration_hours": 3,
    "total_cost": 25000,
    "rental_status": "Rented",
    "payment_method": "QRIS",
    "payment_proof_uploaded": true,
    "timeline": [
      { "old_status": null, "new_status": "Booked", "changed_at": "2026-10-08T13:40:00", "note": "Booking created by customer" },
      { "old_status": "Booked", "new_status": "Rented", "changed_at": "2026-10-08T13:55:00", "note": "Payment verified by admin" }
    ]
  }
}
```

If the combination of code and number is incorrect, the backend returns `404 NOT_FOUND` (without specifying which one is wrong).

---

## 3. Admin Endpoints (token required)

All endpoints in this section require the `Authorization: Bearer <token>` header.

### 3.1 Login

`POST /api/admin/login`

```json
{ "username": "reza", "password": "rahasia123" }
```

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOi...",
    "expires_in": 28800,
    "staff": { "staff_id": 1, "full_name": "Reza Mahardika", "role": "owner" }
  }
}
```

`expires_in` is in seconds. If the token is expired, the backend replies with `401 UNAUTHORIZED` and the frontend redirects back to the login page.

### 3.2 Dashboard

`GET /api/admin/dashboard`

```json
{
  "success": true,
  "data": {
    "counts": { "Booked": 3, "Rented": 2, "Overdue": 1, "Returned": 40 },
    "revenue_today": 150000,
    "revenue_this_month": 3200000,
    "pending_payment_verifications": 2,
    "unverified_identity_docs": 1,
    "overdue_rentals": [
      {
        "rental_id": 2,
        "booking_code": "B7C1D4E9",
        "full_name": "Sinta Dewi",
        "phone": "082345678901",
        "device_name": "PS3 Playbox 01",
        "end_time": "2026-10-08T10:00:00",
        "hours_overdue": 3.5
      }
    ]
  }
}
```

### 3.3 Bookings

| Method | Endpoint | Function |
|---|---|---|
| GET | `/api/admin/bookings` | Booking list (paginated) |
| GET | `/api/admin/bookings/{id}` | Booking details |
| POST | `/api/admin/bookings` | Create a booking on behalf of a customer (Walk-in / WhatsApp) |
| PATCH | `/api/admin/bookings/{id}/verify` | Verify payment |
| PATCH | `/api/admin/bookings/{id}/return` | Mark console as returned |
| POST | `/api/admin/bookings/{id}/extensions` | Extend duration |

**Query `GET /api/admin/bookings`:**

| Query | Description |
|---|---|
| `status` | One of the `rental_status` enums |
| `channel` | Enum `booking_channel` |
| `device_id` | |
| `date_from`, `date_to` | `YYYY-MM-DD` format, based on `start_time` |
| `page`, `per_page` | Default is `1` and `20` |

Each item contains: `rental_id`, `booking_code`, `full_name`, `phone`, `device_name`, `start_time`, `end_time`, `total_cost`, `rental_status`, `booking_channel`, `payment_proof_uploaded`.

`GET /api/admin/bookings/{id}` adds: customer data (`identity_doc_type`, `identity_doc_verified`), `payment_method`, `payment_verified_at`, `deposit_type`, `deposit_value`, `timeline`, `extensions`, and `item_checks`.

`POST /api/admin/bookings` (JSON). Fields are the same as 2.5, but using JSON, `booking_channel` is required, and there are no file uploads. Optional `auto_verify: true` to immediately set status to `Rented` (e.g., paying cash on site).

`PATCH .../verify` has no body. It is only valid from `Booked` to `Rented`; otherwise, it returns `409 INVALID_STATUS_TRANSITION`.

`PATCH .../return` with an optional body:

```json
{
  "deposit_returned": true,
  "item_checks": [
    { "item_name": "Controller", "condition_at_pickup": "Good", "condition_at_return": "Good", "notes": null }
  ]
}
```

Valid from `Rented` or `Overdue` to `Returned`.

`POST .../extensions` :

```json
{ "added_hours": 2, "payment_method": "Cash" }
```

```json
{
  "success": true,
  "data": { "extra_cost": 20000, "end_time": "2026-10-08T19:00:00", "duration_hours": 5, "total_cost": 45000 }
}
```

If it conflicts with the next booking: `409 SLOT_TAKEN`.

### 3.4 Customers and Identity Documents

| Method | Endpoint | Function |
|---|---|---|
| GET | `/api/admin/customers` | Customer list. Query: `search` (name or phone), `identity_verified` (`true`/`false`), `page` |
| GET | `/api/admin/customers/{id}` | Customer details and booking history |
| PATCH | `/api/admin/customers/{id}/verify-identity` | Mark identity document as verified |

### 3.5 Devices

| Method | Endpoint | Function |
|---|---|---|
| GET | `/api/admin/devices` | All devices, including `serial_number` and `status` |
| POST | `/api/admin/devices` | Add a device |
| PUT | `/api/admin/devices/{id}` | Update device data |
| PATCH | `/api/admin/devices/{id}/status` | Change status to `Available` / `Maintenance` |

Body for `POST` and `PUT`:

```json
{
  "device_name": "PS4 Playbox 03",
  "category": "PS4",
  "model": "CUH-1200",
  "serial_number": "SN-PS4-003",
  "booth_code": "B3"
}
```

There is no `DELETE`. Unused devices are changed to `Maintenance` to keep the rental history intact.

### 3.6 Hourly Rates

| Method | Endpoint | Function |
|---|---|---|
| POST | `/api/admin/pricing-tiers` | Add or update a rate (upsert by `device_id` + `min_hours`) |
| DELETE | `/api/admin/pricing-tiers/{id}` | Delete a tier |

```json
{ "device_id": 3, "min_hours": 12, "price_per_hour": 8000 }
```

Every device must have at least one tier with `min_hours = 1`.

### 3.7 Fixed-Price Packages

| Method | Endpoint | Function |
|---|---|---|
| GET | `/api/admin/packages` | All packages, including inactive ones |
| POST | `/api/admin/packages` | Create a package |
| PUT | `/api/admin/packages/{id}` | Change name or price |
| PATCH | `/api/admin/packages/{id}/active` | Activate/deactivate |

`POST` accepts `device_id` **or** `category` (creates a package for all devices in that category at once):

```json
{ "category": "PS4", "package_name": "3 Hour Promo Package", "duration_hours": 3, "package_price": 25000 }
```

`PATCH .../active`:

```json
{ "is_active": false }
```

### 3.8 Reports

| Method | Endpoint | Query | Response Content |
|---|---|---|---|
| GET | `/api/admin/reports/daily` | `date_from`, `date_to` | `[{ date, transactions, revenue }]` |
| GET | `/api/admin/reports/monthly` | `year` | `[{ month, category, transactions, revenue }]` |
| GET | `/api/admin/reports/channels` | `date_from`, `date_to` | `[{ booking_channel, bookings, revenue }]` |

Reports only count bookings with verified payments.

### 3.9 Retrieving Files (Payment Proofs and Identity Documents)

| Method | Endpoint | Function |
|---|---|---|
| GET | `/api/admin/bookings/{id}/payment-proof` | Returns the payment proof image file |
| GET | `/api/admin/customers/{id}/identity-document` | Returns the identity document image file |

The response is a direct image file (not JSON). Because it requires the `Authorization` header, the frontend fetches it using `fetch()` and then displays it via `URL.createObjectURL(blob)`, instead of putting the URL in an `<img src>`.

---

## 4. Booking Status Workflow

```text
Booked ──(admin verifies)──▶ Rented ──(admin marks returned)──▶ Returned
                                 │
                       (passes end_time, automatic)
                                 ▼
                              Overdue ──(admin marks returned)──▶ Returned
```

An extension on an `Overdue` rental where the `end_time` shifts into the future will revert the status to `Rented`.

## 5. Notes for the Frontend

1. Poll `GET /api/devices` every 5 seconds, and stop when the tab is inactive (`visibilitychange`).
2. Handle `409 SLOT_TAKEN` with a friendly message ("Sorry, the console was just booked by someone else") and reload the device list.
3. Do not send prices from the frontend. The backend determines the `total_cost`.
4. Save the admin token and remove it when receiving a `401`.
5. Always display the `booking_code` after a successful booking and provide a copy button.

## 6. Notes for the Backend

1. Set `date_default_timezone_set('Asia/Jakarta')` and PostgreSQL timezone to WIB.
2. Convert `NUMERIC` columns from strings (e.g., `"25000.00"`) to numbers before `json_encode`.
3. The job for marking `Overdue` is run periodically (every minute) via a scheduler.
4. All admin endpoints pass through `AuthMiddleware`, and `owner`-specific features are checked via the `role`.

## 7. Changelog

| Date | Changes | By |
|---|---|---|
| | Initial contract draft | |