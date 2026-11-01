<?php

require __DIR__ . '/../../../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error('METHOD_NOT_ALLOWED', 'Metode HTTP tidak diizinkan. Gunakan GET',405);
}

require_login(['admin', 'owner']);

$bookingId = filter_var($_GET['booking_id'] ?? null, FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1]
]);

if ($bookingId === false) {
    json_error('VALIDATION_ERROR', 'Parameter booking_id harus bilangan bulat minimal 1', 422);
}

try {
    mark_overdue($pdo);

    $sql = "SELECT b.booking_id,
                   b.booking_code,
                   b.booking_channel,
                   to_char(b.created_at, 'YYYY-MM-DD\"T\"HH24:MI:SS') AS created_at,
                   c.full_name AS customer_name,
                   c.phone AS customer_phone,
                   c.email AS customer_email,
                   c.identity_doc_type,
                   (c.identity_doc_url IS NOT NULL) AS identity_doc_uploaded,
                   c.identity_doc_verified,
                   b.payment_method,
                   (b.payment_proof_url IS NOT NULL) AS payment_proof_uploaded,
                   (b.payment_verified_at IS NOT NULL) AS payment_verified,
                   to_char(b.payment_verified_at, 'YYYY-MM-DD\"T\"HH24:MI:SS') AS payment_verified_at,
                   s.full_name AS verified_by,
                   b.deposit_type,
                   b.deposit_value,
                   to_char(b.deposit_returned_at, 'YYYY-MM-DD\"T\"HH24:MI:SS') AS deposit_returned_at,
                   r.rental_id,
                   r.device_id,
                   d.device_name,
                   d.category,
                   d.booth_code,
                   r.package_id,
                   p.package_name,
                   to_char(r.start_time, 'YYYY-MM-DD\"T\"HH24:MI:SS') AS start_time,
                   to_char(r.end_time, 'YYYY-MM-DD\"T\"HH24:MI:SS') AS end_time,
                   r.duration_hours,
                   r.extra_hours,
                   r.extra_cost,
                   r.price_per_hour,
                   r.total_cost,
                   r.rental_status,
                   to_char(r.rented_at, 'YYYY-MM-DD\"T\"HH24:MI:SS') AS rented_at,
                   to_char(r.overdue_at, 'YYYY-MM-DD\"T\"HH24:MI:SS') AS overdue_at,
                   to_char(r.returned_at, 'YYYY-MM-DD\"T\"HH24:MI:SS') AS returned_at,
                   r.condition_at_pickup,
                   r.condition_at_return,
                   r.condition_notes
            FROM booking b
            JOIN users c ON c.user_id = b.customer_id
            LEFT JOIN users s ON s.user_id = b.staff_id
            JOIN rental r ON r.booking_id = b.booking_id
            JOIN device d ON d.device_id = r.device_id
            LEFT JOIN rental_package p ON p.package_id = r.package_id
            WHERE b.booking_id = :booking_id
            ORDER BY r.rental_id ASC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['booking_id' => $bookingId]);
    $rows = $stmt->fetchAll();

    if (!$rows) {
        json_error('NOT_FOUND', 'Pesanan tidak ditemukan', 404);
    }

    $first = $rows[0];
    $items = [];
    $grandTotal = 0.0;

    foreach ($rows as $row) {
        $itemCost = (float) $row['total_cost'];
        $grandTotal += $itemCost;

        $items[] = [
            'rental_id'           => (int) $row['rental_id'],
            'device_id'           => (int) $row['device_id'],
            'device_name'         => $row['device_name'],
            'category'            => $row['category'],
            'booth_code'          => $row['booth_code'],
            'package_id'          => $row['package_id'] !== null ? (int) $row['package_id'] : null,
            'package_name'        => $row['package_name'],
            'start_time'          => $row['start_time'],
            'end_time'            => $row['end_time'],
            'duration_hours'      => (int) $row['duration_hours'],
            'extra_hours'         => (int) $row['extra_hours'],
            'extra_cost'          => (float) $row['extra_cost'],
            'price_per_hour'      => $row['price_per_hour'] !== null ? (float) $row['price_per_hour'] : null,
            'total_cost'          => $itemCost,
            'rental_status'       => $row['rental_status'],
            'timeline'            => build_timeline($row),
            'condition_at_pickup' => $row['condition_at_pickup'],
            'condition_at_return' => $row['condition_at_return'],
            'condition_notes'     => $row['condition_notes'],
        ];
    }

    json_response([
        'success' => true,
        'data' => [
            'booking_id'      => (int) $first['booking_id'],
            'booking_code'    => $first['booking_code'],
            'booking_channel' => $first['booking_channel'],
            'created_at'      => $first['created_at'],
            'customer' => [
                'full_name'             => $first['customer_name'],
                'phone'                 => $first['customer_phone'],
                'email'                 => $first['customer_email'],
                'identity_doc_type'     => $first['identity_doc_type'],
                'identity_doc_uploaded' => (bool) $first['identity_doc_uploaded'],
                'identity_doc_verified' => (bool) $first['identity_doc_verified'],
            ],
            'payment' => [
                'method'         => $first['payment_method'],
                'proof_uploaded' => (bool) $first['payment_proof_uploaded'],
                'verified'       => (bool) $first['payment_verified'],
                'verified_at'    => $first['payment_verified_at'],
                'verified_by'    => $first['verified_by'],
            ],
            'deposit' => [
                'type'        => $first['deposit_type'],
                'value'       => $first['deposit_value'],
                'returned_at' => $first['deposit_returned_at'],
            ],
            'total_cost' => $grandTotal,
            'items'      => $items,
        ],
    ]);
} catch (PDOException $e) {
    error_log("Admin Booking Detaii API Error: " . $e->getMessage());
    json_error('SERVER_ERROR', 'Terjadi kesalahan internal pada server', 500);
}