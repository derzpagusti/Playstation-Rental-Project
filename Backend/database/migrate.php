<?php

if (PHP_SAPI !== 'cli') {
    exit('Script ini hanya boleh dijalankan dari terminal.');
}

require __DIR__ . '/../includes/db.php';   // membaca .env dan menghasilkan $pdo

// Tabel untuk pencatat file yang sudah dijalankan, supaya tidak jalan dua kali
function ensure_tracking_table(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        ran_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )");
}

function run_folder(PDO $pdo, string $type): void {
    $dir = __DIR__ . '/' . $type;
    if (!is_dir($dir)) {
        exit("Folder tidak ditemukan: $dir\n");
    }

    $files = glob($dir . '/*.sql');
    sort($files);                           // 001, 002, 003, ... berurutan

    foreach ($files as $path) {
        $name = $type . '/' . basename($path);

        $check = $pdo->prepare('SELECT 1 FROM schema_migrations WHERE filename = ?');
        $check->execute([$name]);
        if ($check->fetch()) {
            echo "SKIP   $name\n";
            continue;
        }

        try {
            $pdo->beginTransaction();       // satu file = satu transaksi
            $pdo->exec(file_get_contents($path));
            $log = $pdo->prepare('INSERT INTO schema_migrations (filename) VALUES (?)');
            $log->execute([$name]);
            $pdo->commit();
            echo "OK     $name\n";
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            echo "GAGAL  $name\n       " . $e->getMessage() . "\n";
            exit(1);
        }
    }
}

$command = $argv[1] ?? 'migrations';

if ($command === 'fresh') {
    if (env('APP_ENV') !== 'local') {
        exit("Perintah fresh hanya boleh dijalankan jika APP_ENV=local\n");
    }
    $pdo->exec(file_get_contents(__DIR__ . '/reset.sql'));
    echo "Semua tabel dihapus.\n";
    ensure_tracking_table($pdo);
    run_folder($pdo, 'migrations');
    run_folder($pdo, 'seeders');
} elseif ($command === 'migrations' || $command === 'seeders') {
    ensure_tracking_table($pdo);
    run_folder($pdo, $command);
} else {
    exit("Perintah tidak dikenal. Gunakan: migrations | seeders | fresh\n");
}

echo "Selesai.\n";