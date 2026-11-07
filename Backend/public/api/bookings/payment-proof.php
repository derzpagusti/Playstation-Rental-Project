<?php

require __DIR__ . '/../../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('METHOD_NOT_ALLOWED', 'Gunakan method POST', 405);
}

$rawCode = $_POST['booking_code'] ?? null;
$rawPhone = $_POST['phone'] ?? null;
$bookingCode = is_string($rawCode) ? strtoupper(trim($rawCode)) : '';
$phone = is_string($rawPhone) ? normalize_phone($rawPhone) : '';

if (!preg_match('/^[A-Z0-9]{8}$/', $bookingCode) || !preg_match('/^08\d{8,13}$/', $phone)) {
    json_error('VALIDATION_ERROR', 'Kode booking atau format nomor HP tidak valid', 422);
}

$proof = $_FILES['payment_proof'] ?? null;
$uploadError = $proof['error'] ?? UPLOAD_ERR_NO_FILE;
$maxBytes = 2 * 1024 * 1024;

if (in_array($uploadError, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
    json_error('FILE_TOO_LARGE', 'Ukuran bukti pembayaran maksimal 2 MB', 413);
}

if (in_array($uploadError, [UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE, UPLOAD_ERR_EXTENSION], true)) {
    error_log('Payment proof upload failed with PHP error: '. $uploadError);
    json_error('SERVER_ERROR', 'Bukti pembayaran gagal disimpan', 500);
}

$tmpPath = $proof['tmp_name'] ?? null;
$size = $proof['size'] ?? null;

if ($uploadError !== UPLOAD_ERR_OK || !is_string($tmpPath) || !is_int($size)
    || $size < 1 || !is_uploaded_file($tmpPath)) {
    json_error('VALIDATION_ERROR', 'Unggah satu file bukti pembayaran yang valid', 422);
}

if ($size > $maxBytes) {
    json_error('FILE_TOO_LARGE', 'Ukuran bukti pembayaran maksimal 2 MB', 413);
}

$savedPath = null;

try {
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($tmpPath);
    $extensions = ['image/jpeg'=>'jpg', 'image/png'=>'png'];

    if (!isset($extensions[$mime])) {
        json_error('VALIDATION_ERROR', 'Bukti pembayaran harus berupa JPG atau PNG', 422);
    }

    $pdo->beginTransaction();

    $booking = $pdo->prepare('SELECT b.booking_id 
                              FROM booking b 
                                  JOIN users u ON u.user_id = b.customer_id 
                              WHERE b.booking_code = :booking_code AND u.phone = :phone FOR UPDATE OF b');
    $booking->execute(['booking_code' => $bookingCode, 'phone' => $phone]);
    $bookingId = $booking->fetchColumn();

    if ($bookingId === false) {
        $pdo->rollback();
        json_error('NOT_FOUND', 'Periksa kembali kode booking dan nomor HP anda', 404);
    }

    $fileName = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
    $relativePath = 'payment_proof/' . $fileName;

    $update = $pdo->prepare(
        "UPDATE booking
         SET payment_proof_url = :proof_path,
             payment_status = 'AwaitingVerification'
         WHERE booking_id = :booking_id
           AND payment_status = 'Pending'
           AND payment_proof_url IS NULL
           AND (payment_expires_at IS NULL OR payment_expires_at > clock_timestamp())"
    );
    $update->execute(['booking_id' => $bookingId, 'proof_path' => $relativePath]);

    if ($update->rowCount() !== 1) {
        $pdo->rollback();
        json_error('INVALID_STATUS_TRANSITION', 'Pesanan ini tidak dapat menerima bukti pembayaran', 409);
    }

    $uploadRoot = UPLOAD_DIR;
    $directory = $uploadRoot . '/payment_proof';
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Direktori bukti pembayaran belum dibuat');
    }

    $resolveDirectory = realpath($directory);
    if ($resolveDirectory === false) {
        throw new RuntimeException('Directory bukti pembayaran tidak dapat ditemukan');
    }

    $destination = $resolveDirectory . DIRECTORY_SEPARATOR . $fileName;
    if (!@move_uploaded_file($tmpPath, $destination)) {
        throw new RuntimeException('File bukti pembayaran tidak dapat dipindahkan');
    }

    $savedPath = $destination;
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollback();
    }
    if ($savedPath !== null && !@unlink($savedPath)) {
        error_log('Gagal membersihkan file bukti pembayaran ' . $savedPath);
    }

    error_log('Booking Payment Proof API Error: ' . $e->getMessage());
    json_error('SERVER_ERROR', 'Bukti pembayaran gagal disimpan', 500);
}

json_response([
    'success' => true,
    'data' => [
        'booking_code' => $bookingCode,
        'payment_proof_uploaded' => true,
    ],
]);