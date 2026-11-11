<?php

require __DIR__ . "/../../../includes/bootstrap.php";
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error('METHOD_NOT_ALLOWED', 'Gunakan method GET', 405);
}

if (array_key_exists('duration_hours', $_GET)) {
    json_error('VALIDATION_ERROR', 'Gunakan duration_hours untuk durasi sewa harian', 422);
}

$rawStartTime = $_GET['start_time'] ?? null;

if (!is_string($rawStartTime)) {
    json_error('VALIDATION_ERROR', 'start_time wajib diisi berupa teks', 422);
}

$timeZone = new DateTimeZone('Asia/Jakarta');

$startTime = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s', $rawStartTime, $timeZone);

if ($startTime === false || $startTime->format('Y-m-d\TH:i:s') !== $rawStartTime) {
    json_error('VALIDATION_ERROR', 'Format start_time harus YYYY-MM-DDTHH:MM:SS dalam WIB', 422);
}

// Menyamakan toleransi waktu dengan endpoint create.php
$earlierStart = (new DateTimeImmutable('now', $timeZone))->modify('-5 minutes');

if ($startTime < $earlierStart) {
    json_error('VALIDATION_ERROR', 'Waktu mulai tidak boleh lebih dari 5 menit di masa lalu', 422);
}

$rawDuration = $_GET['duration_days'] ?? null;

$durationDays = is_string($rawDuration) ? filter_var($rawDuration, FILTER_VALIDATE_INT,
    ['options' => ['min_range' => 1, 'max_range' => 7]]) : false;

if ($durationDays === false) {
    json_error('VALIDATION_ERROR', 'duration_days harus berupa bilangan bulat antara 1 sampai 7', 422);
}

$category = $_GET['category'] ?? null;

if ($category !== null && (!is_string($category) || !in_array($category, ['PS4', 'PS5'], true))) {
    json_error('VALIDATION_ERROR', 'category harus PS4 atau PS5', 422);
}

$durationHours = $durationDays * 24;
$endTime = $startTime->modify("+{$durationHours} hours");

$params = [
    'start_time' => $startTime->format('Y-m-d H:i:sP'),
    'end_time' => $endTime->format('Y-m-d H:i:sP'),
];

$categoryFilter = '';

if ($category !== null) {
    $categoryFilter = 'AND d.category = :category';
    $params['category'] = $category;
}

try {
    $query = $pdo->prepare("SELECT
            d.device_id,
            d.device_name,
            d.category,
            d.booth_code,
            d.price_per_day
         FROM device d
         WHERE d.status = 'Available'
           {$categoryFilter}

           -- Unit yang belum dikembalikan setelah batas waktunya
           -- tetap tidak dapat dipesan untuk jadwal berikutnya.
           AND NOT EXISTS (
               SELECT 1
               FROM rental held
               WHERE held.device_id = d.device_id
                 AND (
                     held.rental_status = 'Overdue'
                     OR (
                         held.rental_status = 'Rented'
                         AND held.end_time < statement_timestamp()
                     )
                 )
           )

           -- Gunakan aturan bentrok yang sama dengan slot_is_free().
           AND NOT EXISTS (
               SELECT 1
               FROM rental r
               JOIN booking b ON b.booking_id = r.booking_id
               WHERE r.device_id = d.device_id
                 AND r.rental_status IN ('Booked', 'Rented', 'Overdue')
                 AND b.payment_status IN (
                     'Pending', 'AwaitingVerification', 'Paid'
                 )
                 AND (
                     b.payment_status <> 'Pending'
                     OR b.payment_expires_at IS NULL
                     OR b.payment_expires_at > statement_timestamp()
                 )
                 AND r.start_time < CAST(:end_time AS timestamptz)
                 AND r.end_time > CAST(:start_time AS timestamptz)
           )
         ORDER BY d.category ASC, d.device_name ASC, d.device_id ASC");
    $query->execute($params);

    $devices = [];

    foreach ($query->fetchAll() as $device) {
        $devices[] = [
            'device_id' => (int) $device['device_id'],
            'device_name' => $device['device_name'],
            'category' => $device['category'],
            'booth_code' => $device['booth_code'],
            'price_per_day' => (float)$device['price_per_day'],
        ];
    }

    json_response([
        'success' => true,
        'data' => $devices,
        'meta' => [
            'start_time' => $startTime->format('Y-m-d\TH:i:sP'),
            'end_time' => $endTime->format('Y-m-d\TH:i:sP'),
            'duration_days' => $durationDays,
            'duration_hours' => $durationHours,
            'total' => count($devices),
        ],
    ]);
} catch (PDOException $e) {
    error_log('Device Availability API Error: ' . $e->getMessage());
    json_error('SERVER_ERROR', 'Ketersediaan device gagal diambil', 500);
}