<?php

require __DIR__ . '/../../../includes/db.php';
require __DIR__ . '/../../../includes/response.php';
/** @var PDO $pdo */

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error('METHOD_NOT_ALLOWED', 'Method HTTP tidak diizinkan. Gunakan method GET', 405);
}

try {
    $sql = "SELECT d.device_id, d.device_name, d.category, d.booth_code, d.status,
               (r.device_id IS NOT NULL) AS is_rented,
               to_char(r.end_time, 'YYYY-MM-DD\"T\"HH24:MI:SS') AS end_time
        FROM device d
        LEFT JOIN (
            SELECT device_id, MAX(end_time) AS end_time
            FROM rental
            WHERE rental_status IN ('Rented', 'Overdue')
               OR (rental_status = 'Booked' AND start_time <= now() AND end_time > now())
            GROUP BY device_id
        ) r ON r.device_id = d.device_id
        ORDER BY d.category ASC, d.device_name ASC";

    $stmt = $pdo->query($sql);

    $rows = $stmt->fetchAll();

    json_response([
        'success' => true,
        'data' => $rows
    ]);
} catch (PDOException $e) {
    error_log("Device API Error: " . $e->getMessage());

    json_error('SERVER_ERROR', 'Terjadi kesalahan internal server', 500);
}


