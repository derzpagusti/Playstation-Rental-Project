<?php

require __DIR__ . '/../../../includes/bootstrap.php';
/** @var PDO $pdo */

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('METHOD_NOT_ALLOWED', 'Gunakan method POST', 405);
}

$input = read_json_body();

$deviceId = $input['device_id'] ?? null;
$durationDays = $input['duration_days'] ?? null;
$packageId = $input['package_id'] ?? null;

if (!is_int($deviceId) || $deviceId < 1) {
    json_error(
        'VALIDATION_ERROR',
        'device_id harus berupa bilangan bulat minimal 1',
        422
    );
}

// Tolak format lama agar durasi per jam tidak digunakan tanpa sengaja.
if (array_key_exists('duration_hours', $input)) {
    json_error(
        'VALIDATION_ERROR',
        'Gunakan duration_days untuk durasi sewa harian',
        422
    );
}

$hasDuration = $durationDays !== null;
$hasPackage = $packageId !== null;

if ($hasDuration === $hasPackage) {
    json_error(
        'VALIDATION_ERROR',
        'Pilih tepat salah satu: duration_days atau package_id',
        422
    );
}

if ($hasDuration
    && (!is_int($durationDays) || $durationDays < 1 || $durationDays > 7)) {
    json_error(
        'VALIDATION_ERROR',
        'duration_days harus berupa bilangan bulat antara 1 sampai 7',
        422
    );
}

if ($hasPackage && (!is_int($packageId) || $packageId < 1)) {
    json_error(
        'VALIDATION_ERROR',
        'package_id harus berupa bilangan bulat minimal 1',
        422
    );
}

try {
    $deviceQuery = $pdo->prepare(
        'SELECT device_id, price_per_day
         FROM device
         WHERE device_id = :device_id'
    );
    $deviceQuery->execute(['device_id' => $deviceId]);
    $device = $deviceQuery->fetch();

    if (!$device) {
        json_error('NOT_FOUND', 'Device tidak ditemukan', 404);
    }

    if ($hasDuration) {
        $pricePerDay = (float) $device['price_per_day'];
        $durationHours = $durationDays * 24;
        $totalCost = $durationDays * $pricePerDay;
    } else {
        $packageQuery = $pdo->prepare(
            'SELECT duration_hours, package_price
             FROM rental_package
             WHERE package_id = :package_id
               AND device_id = :device_id
               AND is_active = TRUE'
        );
        $packageQuery->execute([
            'package_id' => $packageId,
            'device_id' => $deviceId,
        ]);
        $package = $packageQuery->fetch();

        if (!$package) {
            json_error(
                'NOT_FOUND',
                'Paket tidak ditemukan atau tidak tersedia untuk device ini',
                404
            );
        }

        $durationHours = (int) $package['duration_hours'];
        $durationDays = intdiv($durationHours, 24);
        $pricePerDay = null;
        $totalCost = (float) $package['package_price'];
    }

    json_response([
        'success' => true,
        'data' => [
            'device_id' => $deviceId,
            'duration_days' => $durationDays,
            'duration_hours' => $durationHours,
            'price_per_day' => $pricePerDay,
            'package_id' => $packageId,
            'total_cost' => $totalCost,
        ],
    ]);
} catch (PDOException $e) {
    error_log('Price Calculation API Error: ' . $e->getMessage());

    json_error(
        'SERVER_ERROR',
        'Terjadi kesalahan internal pada server',
        500
    );
}