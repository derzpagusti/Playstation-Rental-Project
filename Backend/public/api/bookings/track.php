<?php

require __DIR__ . "/../../../includes/bootstrap.php";

if ($_SERVER['REQUEST_METHOD'] !== "POST") {
    json_error('METHOD_NOT_ALLOWED', 'Method HTTP tidak sesuai. Gunakan Method POST', 405);
}

$input = read_json_body();

$rawCode = $input['booking_code'] ?? null;
$rawPhone = $input['phone'] ?? null;

if (!is_string($rawCode) || !is_string($rawPhone)) {
    json_error('VALIDATION_ERROR', 'Kode booking dan Nomor HP wajib diisi berupa teks', 422);
}

$bookingCode = strtoupper($rawCode);
$phone = normalize_phone($rawPhone);

if ($bookingCode === '' || $phone === '' || !preg_match('/^[A-Z0-9]{8}$/', $bookingCode)) {
    json_error('VALIDATION_ERROR', 'Kode booking harus 8 karakter huruf/angka dan nomor HP tidak boleh kosong', 422);
}

try {
    mark_overdue($pdo);

    $sql = "SELECT b.booking_code,
                   to_char(b.created_at, 'YYYY-MM-DD\"T\"HH24:MI:SS') AS created_at,
                   b.payment_method,
                   (b.payment_proof_url IS NOT NULL) AS payment_proof_uploaded,
                   (b.payment_verified_at IS NOT NULL) AS payment_verified,
                   r.device_id,
                   d.device_name,
                   to_char(r.start_time, 'YYYY-MM-DD\"T\"HH24:MI:SS') AS start_time,
                   to_char(r.end_time, 'YYYY-MM-DD\"T\"HH24:MI:SS') AS end_time,
                   r.duration_hours,
                   r.extra_hours,
                   r.total_cost,
                   r.rental_status,
                   to_char(r.rented_at, 'YYYY-MM-DD\"T\"HH24:MI:SS') AS rented_at,
                   to_char(r.overdue_at, 'YYYY-MM-DD\"T\"HH24:MI:SS') AS overdue_at,
                   to_char(r.returned_at, 'YYYY-MM-DD\"T\"HH24:MI:SS') AS returned_at
            FROM booking b
            JOIN users u ON u.user_id = b.customer_id
            JOIN rental r ON r.booking_id = b.booking_id
            JOIN device d ON d.device_id = r.device_id
            WHERE b.booking_code = ?
              AND u.phone = ?
            ORDER BY r.device_id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$bookingCode, $phone]);
    $rows = $stmt->fetchAll();

    if (!$rows) {
        json_error('NOT_FOUND', 'Pesanan tidak ditemukan. Periksa kembali kode booking dan nomor HP anda', 404);
    }

    $first = $rows[0];
    $items = [];
    $grandTotal = 0.0;

    foreach ($rows as $row) {
        $timeLine = [
            ['status' => 'Booked', 'at' => $first['created_at']],
        ];

        if ($row['rented_at'] !== null) {
            $timeLine[] = ['status' => 'Rented', 'at' => $row['rented_at']];
        }
        if ($row['overdue_at'] !== null) {
            $timeLine[] = ['status' => 'Overdue', 'at' => $row['overdue_at']];
        }
        if ($row['returned_at'] !== null) {
            $timeLine[] = ['status' => 'Returned', 'at' => $row['returned_at']];
        }

        $itemCost = (float)$row['total_cost'];
        $grandTotal += $itemCost;

        $items[] = [
            'device_id' => (int)$row['device_id'],
            'device_name' => $row['device_name'],
            'start_time' => $row['start_time'],
            'end_time' => $row['end_time'],
            'duration_hours' => (int)$row['duration_hours'],
            'extra_hours' => (int)$row['extra_hours'],
            'total_cost' => $itemCost,
            'rental_status' => $row['rental_status'],
            'timeline' => $timeLine
        ];
    }

    json_response([
        'success' => true,
        'data' => [
            'booking_code' => $first['booking_code'],
            'created_at' => $first['created_at'],
            'payment_method' => $first['payment_method'],
            'payment_proof_uploaded' => (bool)$first['payment_proof_uploaded'],
            'payment_verified' => (bool)$first['payment_verified'],
            'total_cost' => $grandTotal,
            'items' => $items
        ]
    ]);
} catch (PDOException $e) {
    error_log("Booking Track API Error: " . $e->getMessage());
    json_error('SERVER_ERROR', 'Terjadi kesalahan internal pada server', 500);
}