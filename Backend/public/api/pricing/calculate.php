<?php

require __DIR__ . '/../../../includes/bootstrap.php';
/** @var PDO $pdo */

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('METHOD_NOT_ALLOWED', 'Method HTTP tidak diizinkan. Gunakan method POST', 405);
}

$raw = file_get_contents('php://input');
$input = json_decode($raw, true);

if (!is_array($input)) {
    json_error('BAD_REQUEST', 'Format request tidak valid. Harus JSON', 400);
}

$device_id = $input['device_id'] ?? null;
$duration_hours = $input['duration_hours'] ?? null;
$package_id = $input['package_id'] ?? null;

if (!filter_var($device_id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]])) {
    json_error('VALIDATION_ERROR', 'device_id harus berupa angka lebih dari 0', 422);
}

$has_duration = ($duration_hours !== null);
$has_package = ($package_id !== null);

if ($has_duration === $has_package) {
    json_error('VALIDATION_ERROR', 'Pilih tepat salah satu: masukkan duration_hours ATAU package_id', 422);
}

if ($has_duration && !filter_var($duration_hours, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]])) {
    json_error('VALIDATION_ERROR', 'duration_hours harus berupa bilangan bulat minimal 1', 422);
}
if ($has_package && !filter_var($package_id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]])) {
    json_error('VALIDATION_ERROR', 'package_id harus berupa angka lebih dari 0', 422);
}

$device_id = (int)$device_id;

try {
    $stmtDevice = $pdo->prepare("SELECT device_id, price_per_hour
                                       FROM device
                                       WHERE device_id = :device_id");
    $stmtDevice->execute(['device_id' => $device_id]);
    $device = $stmtDevice->fetch();

    if (!$device) {
        json_error('NOT_FOUND', 'Device tidak ditemukan', 404);
    }

    if ($has_duration) {
        // Mode durasi bebas: durasi x harga per jam
        $duration = (int)$duration_hours;
        $price_per_hour = (float)$device['price_per_hour'];
        $total_cost = $duration * $price_per_hour;
        $result_package_id = null;
    } else {
        // Mode paket: harga tetap dari paket
        $stmtPkg = $pdo->prepare("SELECT package_id, duration_hours, package_price
                                        FROM rental_package
                                        WHERE package_id = :package_id
                                        AND device_id = :device_id
                                        AND is_active = true");
        $stmtPkg->execute(['package_id' => $package_id, 'device_id' => $device_id]);
        $package = $stmtPkg->fetch();

        if (!$package) {
            json_error('NOT_FOUND', 'Paket tidak ditemukan atau tidak tersedia', 404);
        }

        $duration = (int)$package['duration_hours'];
        $price_per_hour = null;
        $total_cost = (float)$package['package_price'];
        $result_package_id = (int)$package['package_id'];
    }

    json_response([
        'success' => true,
        'data' => [
            'device_id' => (int)$device['device_id'],
            'duration_hours' => $duration,
            'price_per_hour' => $price_per_hour,
            'package_id' => $result_package_id,
            'total_cost' => $total_cost
        ]
    ]);
} catch (PDOException $e) {
    error_log("Price Calculation API Error: " . $e->getMessage());
    json_error('SERVER_ERROR', 'Terjadi kesalahan internal pada server', 500);
}