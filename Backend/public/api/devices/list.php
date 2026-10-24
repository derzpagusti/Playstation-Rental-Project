<?php

require __DIR__ . '/../../../includes/db.php';
require __DIR__ . '/../../../includes/response.php';
/** @var PDO $pdo */

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error('METHOD_NOT_ALLOWED', 'Method HTTP tidak diizinkan. Gunakan method GET', 405);
}

try {
    $sql = "SELECT device_id, device_name, category, booth_code, status
            FROM device
            ORDER BY category ASC, device_name ASC";

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