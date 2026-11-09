<?php

require __DIR__ . '/../../../../includes/bootstrap.php';
/** @var PDO $pdo */

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('METHOD_NOT_ALLOWED', 'Gunakan metode POST', 405);
}

$auth = require_login(['admin', 'owner']);
$input = read_json_body();

$bookingId = filter_var($input['booking_id'] ?? null, FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1]
]);

if ($bookingId === false) {
    json_error('VALIDATION_ERROR', 'booking_id harus berupa bilangan bulat minimal 1', 422);
}

try {
    $pdo->beginTransaction();

    // Kunci booking agar verifikasi bersamaan diproses bergantian.
    $stmt = $pdo->prepare(
        'SELECT booking_id, booking_code, payment_method,
                payment_status, payment_proof_url, payment_verified_at
         FROM booking
         WHERE booking_id = :booking_id
         FOR UPDATE'
    );
    $stmt->execute(['booking_id' => $bookingId]);
    $booking = $stmt->fetch();

    if (!$booking) {
        $pdo->rollBack();
        json_error('NOT_FOUND', 'Pesanan tidak ditemukan', 404);
    }

    if (!in_array($booking['payment_status'], ['Pending', 'AwaitingVerification'], true)
        || $booking['payment_verified_at'] !== null) {
        $pdo->rollBack();
        json_error('INVALID_STATUS_TRANSITION', 'Status pembayaran tidak dapat diverifikasi', 409);
    }

    if ($booking['payment_method'] !== 'Cash') {
        if (empty($booking['payment_proof_url'])) {
            $pdo->rollBack();
            json_error('PAYMENT_PROOF_REQUIRED', 'Bukti pembayaran wajib diunggah sebelum verifikasi', 409);
        }

        if ($booking['payment_status'] !== 'AwaitingVerification') {
            $pdo->rollBack();
            json_error('INVALID_STATUS_TRANSITION', 'Pembayaran belum berstatus AwaitingVerification', 409);
        }
    }

    // Semua item harus masih Booked sebelum pembayaran disetujui.
    $stmtRentals = $pdo->prepare(
        'SELECT rental_id, device_id, rental_status
         FROM rental
         WHERE booking_id = :booking_id
         ORDER BY rental_id
         FOR UPDATE'
    );
    $stmtRentals->execute(['booking_id' => $bookingId]);
    $rentals = $stmtRentals->fetchAll();

    if (!$rentals) {
        $pdo->rollBack();
        json_error('INVALID_STATUS_TRANSITION', 'Pesanan tidak memiliki item rental', 409);
    }

    foreach ($rentals as $rental) {
        if ($rental['rental_status'] !== 'Booked') {
            $pdo->rollBack();
            json_error('INVALID_STATUS_TRANSITION', 'Semua item rental harus berstatus Booked', 409);
        }
    }

    // Deadline berlaku untuk Pending. Bukti yang sudah diterima
    // boleh diperiksa admin setelah batas waktu upload berlalu.
    $updateBooking = $pdo->prepare(
        "UPDATE booking
         SET payment_status = 'Paid',
             staff_id = :staff_id,
             payment_verified_at = now(),
             paid_at = COALESCE(paid_at, now())
         WHERE booking_id = :booking_id
           AND (
               payment_status = 'AwaitingVerification'
               OR payment_expires_at IS NULL
               OR payment_expires_at > clock_timestamp()
           )
         RETURNING to_char(
             payment_verified_at,
             'YYYY-MM-DD\"T\"HH24:MI:SS'
         ) AS verified_at"
    );
    $updateBooking->execute([
        'staff_id' => $auth['user_id'],
        'booking_id' => $bookingId
    ]);
    $verifiedAt = $updateBooking->fetchColumn();

    if ($verifiedAt === false) {
        $pdo->rollBack();
        json_error('INVALID_STATUS_TRANSITION', 'Batas waktu pembayaran sudah berakhir', 409);
    }

    $updateRentals = $pdo->prepare(
        "UPDATE rental
         SET rental_status = 'Rented',
             rented_at = now()
         WHERE booking_id = :booking_id
           AND rental_status = 'Booked'"
    );
    $updateRentals->execute(['booking_id' => $bookingId]);

    $items = [];
    foreach ($rentals as $rental) {
        $items[] = [
            'rental_id' => (int)$rental['rental_id'],
            'device_id' => (int)$rental['device_id'],
            'rental_status' => 'Rented'
        ];
    }

    $pdo->commit();

    json_response([
        'success' => true,
        'data' => [
            'booking_id' => (int)$booking['booking_id'],
            'booking_code' => $booking['booking_code'],
            'payment_status' => 'Paid',
            'verified_at' => $verifiedAt,
            'verified_by' => $auth['full_name'],
            'items' => $items
        ]
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('Admin Booking Verify API Error: ' . $e->getMessage());
    json_error('SERVER_ERROR', 'Verifikasi pembayaran gagal diproses', 500);
}