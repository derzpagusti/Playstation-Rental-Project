<?php

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        json_error('BAD_REQUEST', 'Format request tidak valid. Body harus berupa JSON', 400);
    }
    return $data;
}

function normalize_phone(string $phone): string
{
    $cleaned = preg_replace('/\D+/', '', $phone);

    if (str_starts_with($cleaned, '62')) {
        $cleaned = '0' . substr($cleaned, 2);
    }
    return $cleaned;
}

function lock_device(PDO $pdo, int $deviceId): array|false
{
    $stmt = $pdo->prepare('SELECT device_id, price_per_hour, status 
                           FROM device 
                           WHERE device_id = ? 
                           FOR UPDATE');
    $stmt->execute([$deviceId]);
    return $stmt->fetch();
}

function device_is_held(PDO $pdo, int $deviceId): bool
{
    $stmt = $pdo->prepare(
        "SELECT EXISTS (
            SELECT 1
            FROM rental
            WHERE device_id = ?
              AND (
                  rental_status = 'Overdue'
                  OR (rental_status = 'Rented' AND end_time < now())
              )
        )"
    );
    $stmt->execute([$deviceId]);
    return (bool)$stmt->fetchColumn();
}

function slot_is_free(PDO $pdo, int $deviceId, string $startDb, string $endDb): bool
{
    $stmt = $pdo->prepare(
        "SELECT NOT EXISTS (
            SELECT 1
            FROM rental
            WHERE device_id = :device_id
              AND rental_status <> 'Returned'
              AND start_time < CAST(:end_db AS timestamptz)
              AND end_time > CAST(:start_db AS timestamptz)
        )"
    );
    $stmt->execute([
        'device_id' => $deviceId,
        'start_db' => $startDb,
        'end_db' => $endDb,
    ]);
    return (bool)$stmt->fetchColumn();
}