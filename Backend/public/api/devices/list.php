<?php

require __DIR__ . '/../../../includes/bootstrap.php';
/** @var PDO $pdo */

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error('METHOD_NOT_ALLOWED', 'Gunakan method GET', 405);
}

try {
    $query = $pdo->query(
        "SELECT
            d.device_id,
            d.device_name,
            d.category,
            d.booth_code,
            d.status,
            d.price_per_day,
            (active_rental.device_id IS NOT NULL) AS is_rented,
            to_char(
                active_rental.end_time,
                'YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM'
            ) AS end_time
         FROM device d
         LEFT JOIN (
             SELECT r.device_id, MAX(r.end_time) AS end_time
             FROM rental r
             JOIN booking b ON b.booking_id = r.booking_id
             WHERE r.rental_status IN ('Rented', 'Overdue')
                OR (
                    r.rental_status = 'Booked'
                    AND r.start_time <= statement_timestamp()
                    AND r.end_time > statement_timestamp()
                    AND b.payment_status IN (
                        'Pending', 'AwaitingVerification', 'Paid'
                    )
                    AND (
                        b.payment_status <> 'Pending'
                        OR b.payment_expires_at IS NULL
                        OR b.payment_expires_at > statement_timestamp()
                    )
                )
             GROUP BY r.device_id
         ) active_rental ON active_rental.device_id = d.device_id
         ORDER BY d.category ASC, d.device_name ASC, d.device_id ASC"
    );

    $devices = [];

    foreach ($query->fetchAll() as $device) {
        $devices[] = [
            'device_id' => (int) $device['device_id'],
            'device_name' => $device['device_name'],
            'category' => $device['category'],
            'booth_code' => $device['booth_code'],
            'status' => $device['status'],
            'price_per_day' => (float) $device['price_per_day'],
            'is_rented' => (bool) $device['is_rented'],
            'end_time' => $device['end_time'],
        ];
    }

    json_response([
        'success' => true,
        'data' => $devices,
    ]);
} catch (PDOException $e) {
    error_log('Device List API Error: ' . $e->getMessage());

    json_error(
        'SERVER_ERROR',
        'Terjadi kesalahan internal pada server',
        500
    );
}