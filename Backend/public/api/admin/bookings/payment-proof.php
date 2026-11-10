<?php

require __DIR__ . '/../../../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error('METHOD_NOT_ALLOWED', 'Gunakan method GET', 405);
}

require_login(['admin', 'owner']);
session_write_close();

$bookingId = filter_var($_GET['booking_id'] ?? null, FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1]
]);

if ($bookingId === false) {
    json_error('VALIDATION_ERROR', 'booking_id harus berupa bilangan bulat minimal 1', 422);
}

try {
    $stmt = $pdo->prepare("SELECT payment_proof_url FROM booking WHERE booking_id = :booking_id");
    $stmt->execute(['booking_id' => $bookingId]);
    $booking = $stmt->fetch();

    if (!$booking) {
        json_error('NOT_FOUND', 'Pesanan tidak ditemukan', 404);
    }

    $relativePath = $booking['payment_proof_url'];

    if ($relativePath === null || $relativePath === '') {
        json_error('NOT_FOUND', 'Bukti pembayaran belum tersedia', 404);
    }

    //Terima nama file di payment_proof
    if (!preg_match('~^payment_proof/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png)$~iD', $relativePath)) {
        throw new RuntimeException('Path bukti pembayaran tidak valid');
    }

    $directory = realpath(UPLOAD_DIR . '/payment_proof');
    $filePath = realpath(UPLOAD_DIR . '/' . $relativePath);

    if ($directory === false || $filePath === false || !is_file($filePath)) {
        json_error('NOT_FOUND', 'File bukti pembayaran tidak ditemukan', 404);
    }

    //Memastikan path hasil resolusi tetap berada di folder yang diizinkan
    $parent = dirname($filePath);
    $insideDirectory = PHP_OS_FAMILY === 'Windows' ? strcasecmp($parent, $directory) === 0 : $parent === $directory;

    if (!$insideDirectory) {
        throw new RuntimeException('File bukti pembayaran berada di luar folder yang diizinkan');
    }

    $maxByte = 2 * 1024 * 1024;
    $contents = @file_get_contents($filePath, false, null, 0, $maxByte + 1);

    if ($contents === false || $contents === '' || strlen($contents) > $maxByte) {
        throw new RuntimeException('File bukti pembayaran tidak dapat dibaca atau ukurannya terlalu besar');
    }

    $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($contents);
    $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png'];

    if (!isset($extensions[$mime])) {
        throw new RuntimeException('Format file bukti pembayaran tidak didukung');
    }

    $extensions = $extensions[$mime];
} catch (Throwable $e) {
    error_log('Admin Payment Proof API Error: '. $e->getMessage());
    json_error('SERVER_ERROR', 'Bukti pembayaran gagal dibaca', 500);
}

header('Content-Type: ' . $mime);
header('Content-Length: ' . strlen($contents));
header(
    'Content-Disposition: inline; filename="payment-proof-' . $bookingId . '.' . $extensions . '"'
);
header('X-Content-Type-Options: nosniff');

echo $contents;
exit;