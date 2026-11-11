<?php

require __DIR__ . '/../../../includes/bootstrap.php';
/** @var PDO $pdo */

header('Cache-Control: private, no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('METHOD_NOT_ALLOWED', 'Gunakan metode POST', 405);
}

$input = read_json_body();

$rawCode = $input['booking_code'] ?? null;
$rawPhone = $input['phone'] ?? null;

if (!is_string($rawCode) || !is_string($rawPhone)) {
    json_error(
        'VALIDATION_ERROR',
        'Kode booking dan nomor HP wajib diisi berupa teks',
        422
    );
}

$bookingCode = strtoupper(trim($rawCode));
$phone = normalize_phone($rawPhone);

if (!preg_match('/^[A-Z0-9]{8}$/', $bookingCode)
    || !preg_match('/^08\d{8,13}$/', $phone)) {
    json_error(
        'VALIDATION_ERROR',
        'Kode booking atau format nomor HP tidak valid',
        422
    );
}

try {
    // Perbarui status sebelum mengambil data pesanan.
    expire_unpaid_bookings($pdo);
    mark_overdue($pdo);

    $stmt = $pdo->prepare(
        "SELECT b.booking_code,
                to_char(
                    b.created_at,
                    'YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM'
                ) AS created_at,
                b.payment_method,
                b.payment_status,
                to_char(
                    b.payment_expires_at,
                    'YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM'
                ) AS payment_expires_at,
                CASE
                    WHEN b.payment_expires_at IS NULL THEN NULL
                    WHEN b.payment_status = 'Pending' THEN
                        GREATEST(
                            0,
                            CEIL(EXTRACT(EPOCH FROM (
                                b.payment_expires_at - statement_timestamp()
                            )))
                        )::integer
                    ELSE 0
                END AS seconds_left,
                (b.payment_proof_url IS NOT NULL) AS payment_proof_uploaded,
                (b.payment_verified_at IS NOT NULL) AS payment_verified,
                r.device_id,
                d.device_name,
                to_char(
                    r.start_time,
                    'YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM'
                ) AS start_time,
                to_char(
                    r.end_time,
                    'YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM'
                ) AS end_time,
                r.package_id,
                r.duration_hours,
                r.price_per_day,
                r.extra_hours,
                r.total_cost,
                r.rental_status,
                to_char(
                    r.rented_at,
                    'YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM'
                ) AS rented_at,
                to_char(
                    r.overdue_at,
                    'YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM'
                ) AS overdue_at,
                to_char(
                    r.returned_at,
                    'YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM'
                ) AS returned_at
         FROM booking b
         JOIN users u ON u.user_id = b.customer_id
         JOIN rental r ON r.booking_id = b.booking_id
         JOIN device d ON d.device_id = r.device_id
         WHERE b.booking_code = :booking_code
           AND u.phone = :phone
         ORDER BY r.device_id ASC"
    );
    $stmt->execute([
        'booking_code' => $bookingCode,
        'phone' => $phone
    ]);
    $rows = $stmt->fetchAll();

    if (!$rows) {
        json_error(
            'NOT_FOUND',
            'Pesanan tidak ditemukan. Periksa kembali kode booking dan nomor HP Anda',
            404
        );
    }

    $first = $rows[0];
    $items = [];
    $grandTotal = 0.0;

    foreach ($rows as $row) {
        $durationHours = (int) $row['duration_hours'];
        $itemCost = (float) $row['total_cost'];

        $grandTotal += $itemCost;

        $items[] = [
            'device_id' => (int) $row['device_id'],
            'device_name' => $row['device_name'],
            'package_id' => $row['package_id'] !== null
                ? (int) $row['package_id']
                : null,
            'start_time' => $row['start_time'],
            'end_time' => $row['end_time'],
            'duration_days' => intdiv($durationHours, 24),
            'duration_hours' => $durationHours,
            'price_per_day' => $row['price_per_day'] !== null
                ? (float) $row['price_per_day']
                : null,
            'extra_hours' => (int) $row['extra_hours'],
            'extra_cost' => (float) $row['extra_cost'],
            'total_cost' => $itemCost,
            'rental_status' => $row['rental_status'],
            'timeline' => build_timeline($row),
        ];
    }

    json_response([
        'success' => true,
        'data' => [
            'booking_code' => $first['booking_code'],
            'created_at' => $first['created_at'],
            'payment_method' => $first['payment_method'],
            'payment_proof_uploaded' => (bool) $first['payment_proof_uploaded'],
            'payment_verified' => (bool) $first['payment_verified'],
            'payment' => [
                'status' => $first['payment_status'],
                'expires_at' => $first['payment_expires_at'],
                'seconds_left' => $first['seconds_left'] !== null
                    ? (int) $first['seconds_left']
                    : null
            ],
            'total_cost' => $grandTotal,
            'items' => $items
        ]
    ]);
} catch (Throwable $e) {
    error_log('Booking Track API Error: ' . $e->getMessage());
    json_error('SERVER_ERROR', 'Status pesanan gagal diambil', 500);
}