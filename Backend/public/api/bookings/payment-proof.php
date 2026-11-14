<?php

require __DIR__ . '/../../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('METHOD_NOT_ALLOWED', 'Gunakan method POST', 405);
}

$auth = require_login(['customer']);

$customerId = filter_var($auth['user_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

if ($customerId === false || $customerId === null) {
    json_error('UNAUTHORIZED', 'Sesi pelanggan tidak valid', 401);
}

$rawCode = $_POST['booking_code'] ?? null;

$bookingCode = is_string($rawCode) ? strtoupper(trim($rawCode)) : '';

if (!preg_match('/^[A-Z0-9]{8}$/', $bookingCode)) {
    json_error('VALIDATION_ERROR', 'Kode booking harus berisi 8 karakter alfanumerik', 422);
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


    $booking = $pdo->prepare(
        "SELECT
        b.booking_id,
        p.payment_id,
        p.payment_method,
        p.payment_status,
        p.payment_expires_at
     FROM booking b
     JOIN payment p
        ON p.booking_id = b.booking_id
     WHERE b.booking_code = :booking_code
       AND b.customer_id = :customer_id
     FOR UPDATE OF b, p"
    );

    $booking->execute([
        'booking_code' => $bookingCode,
        'customer_id' => $customerId
    ]);

    $bookingData = $booking->fetch();

    if (!$bookingData) {
        $pdo->rollBack();

        json_error(
            'NOT_FOUND',
            'Pesanan tidak ditemukan',
            404
        );
    }

    $bookingId = (int) $bookingData['booking_id'];

    if ($bookingData['payment_method'] !== 'QRIS') {
        $pdo->rollBack();
        json_error('PAYMENT_PROOF_NOT_REQUIRED', 'Metode pembayaran ini tidak memerlukan bukti transfer', 409);
    }

    if ($bookingData['payment_status'] !== 'Pending') {
        $pdo->rollBack();
        json_error('INVALID_STATUS_TRANSITION', 'Pembayaran tidak lagi berstatus Pending', 409);
    }

    if ($bookingData['payment_expires_at'] === null) {
        $pdo->rollBack();
        json_error('INVALID_PAYMENT_DEADLINE', 'Batas waktu pembayaran QRIS tidak tersedia', 409);
    }

    $fileName = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
    $relativePath = 'payment_proof/' . $fileName;


    $update = $pdo->prepare(
        "UPDATE payment
     SET payment_proof_url = :proof_path,
         payment_status = 'AwaitingVerification'
     WHERE payment_id = :payment_id
       AND payment_method = 'QRIS'
       AND payment_status = 'Pending'
       AND payment_proof_url IS NULL
       AND payment_expires_at > clock_timestamp()"
    );

    $update->execute([
        'payment_id' => (int) $bookingData['payment_id'],
        'proof_path' => $relativePath
    ]);

    if ($update->rowCount() !== 1) {
        $pdo->rollBack();
        json_error('INVALID_STATUS_TRANSITION', 'Pembayaran sudah diproses atau batas waktu upload telah berakhir', 409);
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
        'payment_method' => 'QRIS',
        'payment_status' => 'AwaitingVerification',
        'payment_proof_uploaded' => true
    ],
]);