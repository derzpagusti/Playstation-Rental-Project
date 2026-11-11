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
    $query = $pdo->prepare('SELECT device_id, price_per_day, status 
                           FROM device 
                           WHERE device_id = :device_id 
                           FOR UPDATE');
    $query->execute(['device_id' => $deviceId]);
    return $query->fetch();
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

function slot_is_free(PDO $pdo, int $deviceId, string $startDb, string $endDb): bool {
    $stmt = $pdo->prepare(
        "SELECT NOT EXISTS (
            SELECT 1
            FROM rental r
            JOIN booking b ON b.booking_id = r.booking_id
            WHERE r.device_id = :device_id
              AND r.rental_status IN ('Booked', 'Rented', 'Overdue')
              AND b.payment_status IN ('Pending', 'AwaitingVerification', 'Paid')
              AND (
                  b.payment_status <> 'Pending'
                  OR b.payment_expires_at IS NULL
                  OR b.payment_expires_at > statement_timestamp()
              )
              AND r.start_time < CAST(:end_db AS timestamptz)
              AND r.end_time > CAST(:start_db AS timestamptz)
        )"
    );
    $stmt->execute([
        'device_id' => $deviceId,
        'start_db' => $startDb,
        'end_db' => $endDb
    ]);

    return (bool) $stmt->fetchColumn();
}

function mark_overdue(PDO $pdo): void
{
    $pdo->exec("UPDATE rental
               SET rental_status = 'Overdue', overdue_at = now() 
               WHERE rental_status = 'Rented' AND end_time < now()");
}

function build_timeline(array $row): array
{
    $timeline = [
        ['status' => 'Booked', 'at' => $row['created_at']],
    ];
    if ($row['rented_at'] !== null) {
        $timeline[] = ['status' => 'Rented', 'at' => $row['rented_at']];
    }
    if ($row['overdue_at'] !== null) {
        $timeline[] = ['status' => 'Overdue', 'at' => $row['overdue_at']];
    }
    if ($row['returned_at'] !== null) {
        $timeline[] = ['status' => 'Returned', 'at' => $row['returned_at']];
    }
    return $timeline;
}

function expire_unpaid_bookings(PDO $pdo): void
{
    $pdo->exec(
        "WITH expired AS (
            UPDATE booking
            SET payment_status = 'Expired'
            WHERE payment_status = 'Pending'
              AND payment_expires_at IS NOT NULL
              AND payment_expires_at <= statement_timestamp()
            RETURNING booking_id
        )
        UPDATE rental
        SET rental_status = 'Cancelled'
        WHERE booking_id IN (SELECT booking_id FROM expired)
          AND rental_status = 'Booked'"
    );
}