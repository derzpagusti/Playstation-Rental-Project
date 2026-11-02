<?php

require __DIR__ . '/../../../../includes/bootstrap.php';
/** @var PDO $pdo */

// 1. Pastikan metode HTTP adalah POST (405)
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('METHOD_NOT_ALLOWED', 'Metode HTTP tidak diizinkan. Gunakan metode POST', 405);
}

// 2. Wajib login dengan role admin atau owner
$auth = require_login(['admin', 'owner']);

// 3. Baca JSON body (400 jika format rusak)
$input = read_json_body();

// 4. Validasi booking_id (bilangan bulat >= 1)
$bookingId = filter_var($input['booking_id'] ?? null, FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1]
]);

if ($bookingId === false) {
    json_error('VALIDATION_ERROR', 'booking_id harus berupa bilangan bulat minimal 1', 422);
}

// 5. Transaksi Database
try {
    $pdo->beginTransaction();

    // a. Kunci baris booking untuk mencegah race condition (FOR UPDATE)
    $stmtBooking = $pdo->prepare(
        "SELECT booking_id, booking_code, payment_method, payment_proof_url, payment_verified_at
         FROM booking
         WHERE booking_id = :booking_id
         FOR UPDATE"
    );
    $stmtBooking->execute(['booking_id' => $bookingId]);
    $booking = $stmtBooking->fetch();

    if (!$booking) {
        $pdo->rollBack();
        json_error('NOT_FOUND', 'Pesanan tidak ditemukan', 404);
    }

    // b. Validasi status verifikasi
    if ($booking['payment_verified_at'] !== null) {
        $pdo->rollBack();
        json_error('INVALID_STATUS_TRANSITION', 'Pembayaran pesanan ini sudah diverifikasi sebelumnya', 409);
    }

    // c. Metode selain Cash wajib memiliki bukti bayar
    if ($booking['payment_method'] !== 'Cash' && ($booking['payment_proof_url'] === null || $booking['payment_proof_url'] === '')) {
        $pdo->rollBack();
        json_error('PAYMENT_PROOF_REQUIRED', 'Bukti pembayaran wajib diunggah sebelum verifikasi', 409);
    }

    // d. Update tabel booking (staff_id selalu dari session, paid_at diisi jika masih null)
    $stmtUpdateBooking = $pdo->prepare(
        "UPDATE booking
         SET staff_id = :staff_id,
             payment_verified_at = now(),
             paid_at = COALESCE(paid_at, now())
         WHERE booking_id = :booking_id
         RETURNING to_char(payment_verified_at, 'YYYY-MM-DD\"T\"HH24:MI:SS') AS verified_at"
    );
    $stmtUpdateBooking->execute([
        'staff_id'   => $auth['user_id'],
        'booking_id' => $bookingId,
    ]);
    $verifiedAt = $stmtUpdateBooking->fetchColumn();

    // e. Update semua konsol dalam pesanan yang berstatus Booked menjadi Rented
    $stmtUpdateRental = $pdo->prepare(
        "UPDATE rental
         SET rental_status = 'Rented',
             rented_at = now()
         WHERE booking_id = :booking_id
           AND rental_status = 'Booked'
         RETURNING rental_id, device_id, rental_status"
    );
    $stmtUpdateRental->execute(['booking_id' => $bookingId]);
    $updatedRentals = $stmtUpdateRental->fetchAll();

    $items = [];
    foreach ($updatedRentals as $item) {
        $items[] = [
            'rental_id'     => (int) $item['rental_id'],
            'device_id'     => (int) $item['device_id'],
            'rental_status' => $item['rental_status'],
        ];
    }

    $pdo->commit();

    // f. Kirim respons sukses 200
    json_response([
        'success' => true,
        'data'    => [
            'booking_id'   => (int) $booking['booking_id'],
            'booking_code' => $booking['booking_code'],
            'verified_at'  => $verifiedAt,
            'verified_by'  => $auth['full_name'],
            'items'        => $items,
        ],
    ]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Admin Booking Verify API Error: " . $e->getMessage());
    json_error('SERVER_ERROR', 'Terjadi kesalahan internal pada server', 500);
}