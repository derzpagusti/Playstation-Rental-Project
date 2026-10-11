# API Contract — PSManagement

Kontrak antara backend (PHP native) dan frontend. **Jika ada perubahan endpoint, request, atau response, update dokumen ini dulu lalu kabari di grup sebelum merge.**

## 1. Konvensi Umum

| Hal | Aturan |
|---|---|
| Base URL (lokal) | `http://psmanagement.test/api` (sesuaikan dengan virtual host Laragon) |
| Format data | JSON (`Content-Type: application/json`), kecuali endpoint upload file memakai `multipart/form-data` |
| Penamaan field | `snake_case`, sama persis dengan nama kolom database |
| Uang | Angka bulat rupiah tanpa format, contoh `25000` (frontend yang memformat menjadi "Rp 25.000") |
| Tanggal dan jam | `YYYY-MM-DDTHH:MM:SS` dalam WIB tanpa offset, contoh `2026-10-08T14:00:00` |
| Auth admin | Header `Authorization: Bearer <token>` |
| Auth customer | Tidak ada login. Pesanan diakses dengan `booking_code` + `phone` |
| CORS | Backend mengizinkan origin frontend (Live Server / virtual host) |

### Format response

Sukses:

```json
{ "success": true, "data": { } }
```

Sukses dengan paginasi:

```json
{ "success": true, "data": [ ], "meta": { "page": 1, "per_page": 20, "total": 57 } }
```

Gagal:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Data tidak valid",
  "errors": { "duration_hours": "Durasi minimal 1 jam" }
}
```

`errors` hanya muncul pada `VALIDATION_ERROR`. Frontend menampilkan `message` ke pengguna dan memakai `code` untuk logika.

### Status code dan error code

| HTTP | `code` | Arti |
|---|---|---|
| 400 | `BAD_REQUEST` | Body bukan JSON yang valid |
| 401 | `UNAUTHORIZED` | Token admin tidak ada, salah, atau kedaluwarsa |
| 401 | `INVALID_CREDENTIALS` | Username atau password admin salah |
| 403 | `FORBIDDEN` | Role tidak berhak (contoh: `admin` mengakses fitur khusus `owner`) |
| 404 | `NOT_FOUND` | Data tidak ditemukan, termasuk kombinasi `booking_code` + `phone` yang salah |
| 409 | `SLOT_TAKEN` | Device sudah dipesan pada rentang waktu itu |
| 409 | `DEVICE_MAINTENANCE` | Device sedang maintenance |
| 409 | `DEVICE_OVERDUE` | Device belum dikembalikan penyewa sebelumnya |
| 409 | `INVALID_STATUS_TRANSITION` | Perubahan status tidak valid (contoh: verifikasi booking yang sudah `Rented`) |
| 413 | `FILE_TOO_LARGE` | File upload melebihi batas (maks 2 MB) |
| 422 | `VALIDATION_ERROR` | Input tidak lolos validasi |
| 429 | `BOOKING_LIMIT_REACHED` | Nomor HP sudah punya 2 booking aktif |
| 500 | `SERVER_ERROR` | Kesalahan server |

### Enum

| Nama | Nilai |
|---|---|
| `rental_status` | `Booked`, `Rented`, `Overdue`, `Returned` |
| `payment_method` | `QRIS`, `Transfer Bank`, `Cash` |
| `booking_channel` | `Online`, `Walk-in`, `WhatsApp` |
| `category` | `PS3`, `PS4` |
| `identity_doc_type` | `Kartu Pelajar`, `KTP`, `SIM` |
| `device.status` (admin) | `Available`, `Maintenance` |
| `availability` (publik) | `available` (hijau), `rented` (merah), `maintenance` (abu-abu) |

### Aturan upload file

| Jenis | Format | Ukuran maks |
|---|---|---|
| Bukti bayar | JPG, PNG | 2 MB |
| Dokumen identitas | JPG, PNG | 2 MB |

File disimpan di luar `public/`, jadi tidak ada URL langsung. Admin mengambilnya lewat endpoint khusus (lihat bagian 3.8).

---

## 2. Endpoint Publik (Customer, tanpa login)

### 2.1 Daftar device dan status ketersediaan

`GET /api/devices`

Dipakai halaman utama. **Frontend memanggil ulang tiap 5 detik (polling)** untuk memperbarui indikator hijau/merah tanpa reload.

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

`availability` bernilai `rented` jika ada rental berstatus `Booked`, `Rented`, atau `Overdue` yang rentang waktunya mencakup waktu sekarang.

### 2.2 Device yang tersedia pada rentang waktu

`GET /api/devices/available?start_time=2026-10-08T14:00:00&duration_hours=3`

| Query | Wajib | Keterangan |
|---|---|---|
| `start_time` | Ya | Waktu mulai sewa |
| `duration_hours` | Ya | Bilangan bulat ≥ 1 |
| `category` | Tidak | `PS3` atau `PS4` |

Response: array berisi `device_id`, `device_name`, `category`, `booth_code`.

### 2.3 Harga dan paket sebuah device

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
      { "package_id": 2, "package_name": "Paket Hemat 3 Jam", "duration_hours": 3, "package_price": 25000 }
    ]
  }
}
```

Hanya paket dengan `is_active = true` yang dikirim.

### 2.4 Hitung harga (pratinjau)

`POST /api/pricing/calculate`

Kirim **salah satu**: `duration_hours` atau `package_id`.

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

Frontend boleh menghitung sendiri untuk tampilan instan, tetapi **angka resmi selalu dari server saat booking dibuat**.

### 2.5 Buat booking

`POST /api/bookings` (`multipart/form-data`)

| Field | Wajib | Keterangan |
|---|---|---|
| `full_name` | Ya | Maks 100 karakter |
| `phone` | Ya | Format `08xxxxxxxxxx`, 10–15 digit |
| `email` | Tidak | Format email valid |
| `device_id` | Ya | |
| `start_time` | Ya | Harus di masa depan atau sekarang |
| `duration_hours` | Salah satu | Bilangan bulat ≥ 1, tanpa `package_id` |
| `package_id` | Salah satu | Tanpa `duration_hours` |
| `payment_method` | Ya | Enum `payment_method` |
| `booking_channel` | Tidak | Default `Online` |
| `identity_doc_type` | Kondisional | Wajib jika customer belum punya dokumen tersimpan |
| `identity_doc` | Kondisional | File, wajib jika customer belum punya dokumen tersimpan |

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

Error yang mungkin: `VALIDATION_ERROR`, `SLOT_TAKEN`, `DEVICE_MAINTENANCE`, `DEVICE_OVERDUE`, `BOOKING_LIMIT_REACHED`.

Frontend wajib menampilkan `booking_code` dengan jelas dan menyuruh customer menyimpannya, karena itu satu-satunya cara melacak pesanan.

### 2.6 Upload bukti bayar

`POST /api/bookings/{booking_code}/payment-proof` (`multipart/form-data`)

| Field | Wajib | Keterangan |
|---|---|---|
| `phone` | Ya | Harus cocok dengan nomor pemilik booking |
| `payment_proof` | Ya | File gambar |

```json
{ "success": true, "data": { "booking_code": "A3F9B2C1", "payment_proof_uploaded": true } }
```

### 2.7 Lacak pesanan

`POST /api/bookings/track`

Memakai `POST` supaya nomor HP tidak muncul di URL atau log server.

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
      { "old_status": null, "new_status": "Booked", "changed_at": "2026-10-08T13:40:00", "note": "Booking dibuat oleh customer" },
      { "old_status": "Booked", "new_status": "Rented", "changed_at": "2026-10-08T13:55:00", "note": "Pembayaran diverifikasi admin" }
    ]
  }
}
```

Jika kombinasi kode dan nomor salah, backend mengembalikan `404 NOT_FOUND` (tanpa membedakan mana yang salah).

---

## 3. Endpoint Admin (wajib token)

Semua endpoint di bagian ini butuh header `Authorization: Bearer <token>`.

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

`expires_in` dalam detik. Jika token kedaluwarsa, backend membalas `401 UNAUTHORIZED` dan frontend mengarahkan kembali ke halaman login.

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

### 3.3 Booking

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/admin/bookings` | Daftar booking (paginasi) |
| GET | `/api/admin/bookings/{id}` | Detail booking |
| POST | `/api/admin/bookings` | Buat booking atas nama customer (Walk-in / WhatsApp) |
| PATCH | `/api/admin/bookings/{id}/verify` | Verifikasi pembayaran |
| PATCH | `/api/admin/bookings/{id}/return` | Tandai console dikembalikan |
| POST | `/api/admin/bookings/{id}/extensions` | Perpanjang durasi |

**Query `GET /api/admin/bookings`:**

| Query | Keterangan |
|---|---|
| `status` | Salah satu enum `rental_status` |
| `channel` | Enum `booking_channel` |
| `device_id` | |
| `date_from`, `date_to` | Format `YYYY-MM-DD`, berdasarkan `start_time` |
| `page`, `per_page` | Default `1` dan `20` |

Setiap item: `rental_id`, `booking_code`, `full_name`, `phone`, `device_name`, `start_time`, `end_time`, `total_cost`, `rental_status`, `booking_channel`, `payment_proof_uploaded`.

**`GET /api/admin/bookings/{id}`** menambahkan: data customer (`identity_doc_type`, `identity_doc_verified`), `payment_method`, `payment_verified_at`, `deposit_type`, `deposit_value`, `timeline`, `extensions`, dan `item_checks`.

**`POST /api/admin/bookings`** (JSON). Field sama seperti 2.5, tetapi memakai JSON, `booking_channel` wajib diisi, dan tanpa upload file. Opsional `auto_verify: true` untuk langsung berstatus `Rented` (contoh: bayar cash di tempat).

**`PATCH .../verify`** tanpa body. Hanya valid dari `Booked` ke `Rented`, selain itu `409 INVALID_STATUS_TRANSITION`.

**`PATCH .../return`** dengan body opsional:

```json
{
  "deposit_returned": true,
  "item_checks": [
    { "item_name": "Controller", "condition_at_pickup": "Baik", "condition_at_return": "Baik", "notes": null }
  ]
}
```

Valid dari `Rented` atau `Overdue` ke `Returned`.

**`POST .../extensions`:**

```json
{ "added_hours": 2, "payment_method": "Cash" }
```

```json
{
  "success": true,
  "data": { "extra_cost": 20000, "end_time": "2026-10-08T19:00:00", "duration_hours": 5, "total_cost": 45000 }
}
```

Jika bentrok dengan booking berikutnya: `409 SLOT_TAKEN`.

### 3.4 Customer dan dokumen identitas

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/admin/customers` | Daftar customer. Query: `search` (nama atau HP), `identity_verified` (`true`/`false`), `page` |
| GET | `/api/admin/customers/{id}` | Detail customer dan riwayat booking |
| PATCH | `/api/admin/customers/{id}/verify-identity` | Tandai dokumen identitas terverifikasi |

### 3.5 Device

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/admin/devices` | Semua device, termasuk `serial_number` dan `status` |
| POST | `/api/admin/devices` | Tambah device |
| PUT | `/api/admin/devices/{id}` | Ubah data device |
| PATCH | `/api/admin/devices/{id}/status` | Ubah status `Available` / `Maintenance` |

Body `POST` dan `PUT`:

```json
{
  "device_name": "PS4 Playbox 03",
  "category": "PS4",
  "model": "CUH-1200",
  "serial_number": "SN-PS4-003",
  "booth_code": "B3"
}
```

Tidak ada `DELETE`. Device yang tidak dipakai diubah ke `Maintenance` supaya riwayat rental tetap utuh.

### 3.6 Tarif per jam

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/admin/pricing-tiers` | Tambah atau perbarui tarif (upsert per `device_id` + `min_hours`) |
| DELETE | `/api/admin/pricing-tiers/{id}` | Hapus tier |

```json
{ "device_id": 3, "min_hours": 12, "price_per_hour": 8000 }
```

Setiap device wajib punya minimal satu tier dengan `min_hours = 1`.

### 3.7 Paket harga tetap

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/admin/packages` | Semua paket, termasuk yang nonaktif |
| POST | `/api/admin/packages` | Buat paket |
| PUT | `/api/admin/packages/{id}` | Ubah nama atau harga |
| PATCH | `/api/admin/packages/{id}/active` | Aktif/nonaktifkan |

`POST` menerima `device_id` **atau** `category` (membuat paket untuk semua device di kategori itu sekaligus):

```json
{ "category": "PS4", "package_name": "Paket Hemat 3 Jam", "duration_hours": 3, "package_price": 25000 }
```

`PATCH .../active`:

```json
{ "is_active": false }
```

### 3.8 Laporan

| Method | Endpoint | Query | Isi response |
|---|---|---|---|
| GET | `/api/admin/reports/daily` | `date_from`, `date_to` | `[{ date, transactions, revenue }]` |
| GET | `/api/admin/reports/monthly` | `year` | `[{ month, category, transactions, revenue }]` |
| GET | `/api/admin/reports/channels` | `date_from`, `date_to` | `[{ booking_channel, bookings, revenue }]` |

Laporan hanya menghitung booking dengan pembayaran sudah diverifikasi.

### 3.9 Mengambil file (bukti bayar dan dokumen identitas)

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/admin/bookings/{id}/payment-proof` | Mengembalikan file gambar bukti bayar |
| GET | `/api/admin/customers/{id}/identity-document` | Mengembalikan file gambar dokumen identitas |

Response berupa file gambar langsung (bukan JSON). Karena membutuhkan header `Authorization`, frontend mengambilnya dengan `fetch()` lalu menampilkannya lewat `URL.createObjectURL(blob)`, bukan memasang URL di `<img src>`.

---

## 4. Alur Status Booking

```
Booked ──(admin verifikasi)──▶ Rented ──(admin tandai kembali)──▶ Returned
                                 │
                       (lewat end_time, otomatis)
                                 ▼
                              Overdue ──(admin tandai kembali)──▶ Returned
```

Perpanjangan pada rental `Overdue` yang `end_time`-nya menjadi di masa depan akan mengembalikan status ke `Rented`.

## 5. Catatan untuk Frontend

1. Polling `GET /api/devices` tiap 5 detik, dan hentikan saat tab tidak aktif (`visibilitychange`).
2. Tangani `409 SLOT_TAKEN` dengan pesan ramah ("Maaf, console baru saja dipesan orang lain") dan muat ulang daftar device.
3. Jangan mengirim harga dari frontend. Backend yang menentukan `total_cost`.
4. Simpan token admin dan hapus saat menerima `401`.
5. Selalu tampilkan `booking_code` setelah booking berhasil dan sediakan tombol salin.

## 6. Catatan untuk Backend

1. Set `date_default_timezone_set('Asia/Jakarta')` dan zona waktu PostgreSQL ke WIB.
2. Konversi kolom `NUMERIC` dari string (`"25000.00"`) menjadi angka sebelum `json_encode`.
3. Job penandaan `Overdue` dijalankan berkala (tiap menit) lewat scheduler.
4. Semua endpoint admin melewati `AuthMiddleware`, dan fitur khusus `owner` dicek lewat `role`.

## 7. Changelog

| Tanggal | Perubahan | Oleh |
|---|---|---|
| | Draft awal kontrak | |