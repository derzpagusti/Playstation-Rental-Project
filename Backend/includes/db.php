<?php

// Membaca .env, konek PDO PostgreSQL dan mengatur zona waktu
require_once __DIR__ . '/env.php';
loadEnv(__DIR__ . '/../.env');

$timezone = env('APP_TIMEZONE', 'Asia/Jakarta');
date_default_timezone_set($timezone);

function db_fail(string $detail): void
{
    error_log($detail);

    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, "Koneksi database gagal: $detail\n");
        exit(1);
    }

    http_response_code(500);
    header('Content-Type: application/json');
    $body = ['success' => false, 'code' => 'SERVER_ERROR', 'message' => 'Database connection failed'];

    if (env('APP_DEBUG') === 'true') {
        $body['detail'] = $detail;
    }
    exit(json_encode($body));
}

if (env('DB_NAME', '') === '' || env('DB_USER', '') === '') {
    db_fail('DB_NAME atau DB_USER di .env belum diisi');
}

$dsn = sprintf(
    'pgsql:host=%s;port=%s;dbname=%s',
    env('DB_HOST', 'localhost'),
    env('DB_PORT', '5432'),
    env('DB_NAME')
);

try {
    $pdo = new PDO($dsn, env('DB_USER'), env('DB_PASSWORD'), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('SET TIME ZONE ' . $pdo->quote($timezone));
} catch (PDOException $e) {
    db_fail($e->getMessage());
}