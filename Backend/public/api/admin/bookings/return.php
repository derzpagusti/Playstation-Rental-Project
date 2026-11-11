<?php

require __DIR__ . '/../../../../includes/bootstrap.php';
/** @var PDO $pdo */

// 1. Pastikan metode HTTP adalah POST (405)
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('METHOD_NOT_ALLOWED', 'Metode HTTP tidak diizinkan. Gunakan metode POST', 405);
}

// 2. Wajib login dengan role admin atau owner
require_login(['admin', 'owner']);

// 3. Baca JSON body
$input = read_json_body();

// 4. Validasi rental_id (wajib, integer >= 1)
$rentalId = filter_var($input['rental_id'] ?? null, FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1]
]);

$rentalId = $input['rental_id'] ?? null;

if (!is_int($rentalId) || $rentalId < 1) {
    json_error(
        'VALIDATION_ERROR',
        'rental_id harus berupa bilangan bulat minimal 1',
        422
    );
}

// 5. Validasi condition_at_return (opsional, string, maks 100 karakter)
$conditionAtReturn = null;
if (array_key_exists('condition_at_return', $input) && $input['condition_at_return'] !== null) {
    if (!is_string($input['condition_at_return'])) {
        json_error('VALIDATION_ERROR', 'condition_at_return harus berupa teks', 422);
    }
    $trimmedCond = trim($input['condition_at_return']);
    if (mb_strlen($trimmedCond) > 100) {
        json_error('VALIDATION_ERROR', 'condition_at_return maksimal 100 karakter', 422);
    }
    $conditionAtReturn = $trimmedCond !== '' ? $trimmedCond : null;
}

// 6. Validasi condition_notes (opsional, string, maks 255 karakter)
$conditionNotes = null;
if (array_key_exists('condition_notes', $input) && $input['condition_notes'] !== null) {
    if (!is_string($input['condition_notes'])) {
        json_error('VALIDATION_ERROR', 'condition_notes harus berupa teks', 422);
    }
    $trimmedNotes = trim($input['condition_notes']);
    if (mb_strlen($trimmedNotes) > 255) {
        json_error('VALIDATION_ERROR', 'condition_notes maksimal 255 karakter', 422);
    }
    $conditionNotes = $trimmedNotes !== '' ? $trimmedNotes : null;
}

// 8. Transaksi Database
try {
    expire_unpaid_bookings($pdo);
    mark_overdue($pdo);

    $pdo->beginTransaction();

    // Kunci booking terlebih dahulu agar pengembalian antar-item
    // pada booking yang sama diproses bergantian.
    $stmtBooking = $pdo->prepare(
        'SELECT b.booking_id
         FROM booking b
         JOIN rental r ON r.booking_id = b.booking_id
         WHERE r.rental_id = :rental_id
         FOR UPDATE OF b'
    );
    $stmtBooking->execute(['rental_id' => $rentalId]);

    if ($stmtBooking->fetchColumn() === false) {
        $pdo->rollBack();

        json_error('NOT_FOUND', 'Item rental tidak ditemukan', 404);
    }

    $stmtRental = $pdo->prepare(
        "SELECT r.rental_id, r.booking_id, r.device_id, r.rental_status, b.booking_code
         FROM rental r
         JOIN booking b ON b.booking_id = r.booking_id
         WHERE r.rental_id = :rental_id
         FOR UPDATE OF r"
    );
    $stmtRental->execute(['rental_id' => $rentalId]);
    $rental = $stmtRental->fetch();

    if (!$rental) {
        $pdo->rollBack();
        json_error('NOT_FOUND', 'Item rental tidak ditemukan', 404);
    }

    // b. Validasi transisi status
    if (!in_array($rental['rental_status'], ['Rented', 'Overdue'], true)) {
        $pdo->rollBack();

        json_error(
            'INVALID_STATUS_TRANSITION',
            'Hanya rental berstatus Rented atau Overdue yang dapat dikembalikan',
            409
        );
    }

    // c. Update rental menjadi Returned (COALESCE menjaga nilai jika parameter null)
    $stmtUpdate = $pdo->prepare(
        "UPDATE rental
     SET rental_status = 'Returned',
         returned_at = clock_timestamp(),
         condition_at_return = COALESCE(:cond, condition_at_return),
         condition_notes = COALESCE(:notes, condition_notes)
     WHERE rental_id = :rental_id
       AND rental_status IN ('Rented', 'Overdue')
     RETURNING to_char(
         returned_at,
         'YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM'
     ) AS returned_at"
    );
    $stmtUpdate->execute([
        'cond' => $conditionAtReturn,
        'notes' => $conditionNotes,
        'rental_id' => $rentalId,
    ]);
    $returnedAt = $stmtUpdate->fetchColumn();

    if ($returnedAt === false) {
        throw new RuntimeException('Status pengembalian gagal diperbarui');
    }

    // d. Periksa apakah seluruh konsol pada booking ini sudah dikembalikan
    $stmtCount = $pdo->prepare(
        "SELECT COUNT(*)
         FROM rental
         WHERE booking_id = :booking_id
           AND rental_status <> 'Returned'"
    );
    $stmtCount->execute(['booking_id' => $rental['booking_id']]);
    $remaining = (int)$stmtCount->fetchColumn();
    $bookingAllReturned = ($remaining === 0);

    $pdo->commit();

    // e. Kirim respons sukses 200
    json_response([
        'success' => true,
        'data' => [
            'rental_id' => (int)$rental['rental_id'],
            'booking_code' => $rental['booking_code'],
            'device_id' => (int)$rental['device_id'],
            'rental_status' => 'Returned',
            'returned_at' => $returnedAt,
            'booking_all_returned' => $bookingAllReturned,
        ],
    ]);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Admin Booking Return API Error: " . $e->getMessage());
    json_error('SERVER_ERROR', 'Terjadi kesalahan internal pada server', 500);
}