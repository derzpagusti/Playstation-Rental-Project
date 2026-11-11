<?php

require __DIR__ . '/../../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error('METHOD_NOT_ALLOWED', 'Method HTTP tidak diizinkan. Gunakan method GET', 405);
}

$device_id = $_GET['device_id'] ?? null;

if (!filter_var($device_id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]])) {
    json_error('VALIDATION_ERROR', 'Parameter device_id tidak valid. Harus berupa angka lebih dari 0', 422);
}

try {
    $sqlDevice = "SELECT device_id, device_name, category, booth_code, status, price_per_day
                  FROM device WHERE device_id = :device_id";
    $stmtDevice = $pdo->prepare($sqlDevice);
    $stmtDevice->execute(['device_id' => $device_id]);
    $device = $stmtDevice->fetch();

    if (!$device) {
        json_error('NOT_FOUND', 'Device tidak ditemukan', 404);
    }

    $sqlPackage = "SELECT package_id, package_name, duration_hours, package_price 
                   FROM rental_package 
                   WHERE device_id = :device_id AND is_active = true 
                   ORDER BY duration_hours ASC";
    $stmtPackage = $pdo->prepare($sqlPackage);
    $stmtPackage->execute(['device_id' => $device_id]);
    $packages = $stmtPackage->fetchAll();

    $device['price_per_day'] = (float) $device['price_per_day'];

    foreach ($packages as $pkg) {
        $pkg['package_id'] = (int) $pkg['package_id'];
        $pkg['duration_hours'] = (int) $pkg['duration_hours'];
        $pkg['duration_days'] = (int) $pkg['duration_days'];
        $pkg['package_price'] = (float) $pkg['package_price'];
    }

    unset($pkg);

    $device['packages'] = $packages;

    json_response([
        'success' => true,
        'data' => [
            'device_id' => (int) $device['device_id'],
            'device_name' => $device['device_name'],
            'category' => $device['category'],
            'booth_code' => $device['booth_code'],
            'status' => $device['status'],
            'price_per_day' => (float) $device['price_per_day'],
            'packages' => $packages,
        ],
    ]);

} catch (PDOException $e) {
    error_log('Device Pricing API Error: ' . $e->getMessage());
    json_error('INTERNAL_SERVER_ERROR', 'Terjadi kesalahan pada server', 500);
}
