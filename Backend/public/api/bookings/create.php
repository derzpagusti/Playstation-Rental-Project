<?php

require __DIR__ . '/../../../includes/bootstrap.php';
/** @var PDO $pdo */

//1. Memastikan metode harus POST dan baca JSON body
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('METHOD_NOT_ALLOWED', 'Metode HTTP tidak diizinkan. Gunakan metode POST', 405);
}

$input = read_json_body();

//2. Validasi semua field input sebelum memasukkan ke database
//a. Validasi full_name (Wajin, panjang 1-100 setelah trim)
$rawName = $input['full_name'] ?? '';
if (!is_string($rawName)) {
    json_error('VALIDATION_ERROR', 'Nama lengkap harus berupa teks', 422);
}
$fullName = trim($rawName);
$nameLen = mb_strlen($fullName);
if ($nameLen < 1 || $nameLen > 100) {
    json_error('VALIDATION_ERROR', 'Nama lengkap wajib diisi 1-100 karakter', 422);
}

//b. Validasi phone (Wajib, setelah normalize harus cocok ^08\d{8,13}$)
$rawPhone = $input['phone'] ?? '';
if (!is_string($rawPhone)) {
    json_error('VALIDATION_ERROR', 'Nomor HP harus berupa teks', 422);
}
$phone = normalize_phone($rawPhone);
if (!preg_match('/^08\d{8,13}$/', $phone)) {
    json_error('VALIDATION_ERROR', 'Nomor HP tidak valid. Gunakan format 10-15 digit diawali 08', 422);
}

//c. Validasi device_id (bilangan bulat >= 1)
$deviceId = filter_var($input['device_id'] ?? null, FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1]
]);
if ($deviceId === false) {
    json_error('VALIDATION_ERROR', 'device_id harus berupa bilangan bulat minimal 1', 422);
}

//d. Validasi start_time (Wajib, format YYYY-MM-DDTHH:MM:SS, maksimal 5 menit di masa lalu)
$startTimeStr = $input['start_time'] ?? '';
if (!is_string($startTimeStr)) {
    json_error('VALIDATION_ERROR', 'start_time harus berupa teks', 422);
}
$startDt = DateTimeImmutable::createFromFormat('Y-m-d\TH:i:s', $startTimeStr);
// Pencocokan ulang format() mencegah tanggal tidak sah seperti 2026-02-31 lolos dan bergeser ke Maret
if ($startDt === false || $startDt->format('Y-m-d\TH:i:s') !== $startTimeStr) {
    json_error('VALIDATION_ERROR', 'Format start_time tidak valid. Gunakan YYYY-MM-DDTHH:MM:SS', 422);
}

$fiveMinutesAgo = (new DateTimeImmutable())->modify('-5 minutes');
if ($startDt < $fiveMinutesAgo) {
    json_error('VALIDATION_ERROR', 'Waktu mulai (start_time) tidak boleh lebih dari 5 menit di masa lalu', 422);
}

//e. Validasi duration_hours (Bilangan bulat 1-168)
$durationHours = filter_var($input['duration_hours'] ?? null, FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1, 'max_range' => 168]
]);
if ($durationHours === false) {
    json_error('VALIDATION_ERROR', 'duration_hours harus berupa bilangan bulat 1-168', 422);
}

//f. Validasi payment_method (Salah satu dari QRIS, Transfer Bank, Cash)
$paymentMethod = $input['payment_method'] ?? '';
$allowedMethods = ['QRIS', 'Transfer Bank', 'Cash'];
if (!is_string($paymentMethod) || !in_array($paymentMethod, $allowedMethods, true)) {
    json_error('VALIDATION_ERROR', 'Metode pembayaran harus salah satu dari QRIS, Transfer Bank, atau Cash', 422);
}

//3. Hitung waktu selesai dan menyiapkan format teks berzona waktu untuk PostgreSQL
$endDt = $startDt->modify("+{$durationHours} hours");
$startTimeDb = $startDt->format('Y-m-d H:i:sP');
$endTimeDb = $endDt->format('Y-m-d H:i:sP');

//4. Transaksi Database
try {
    $pdo->beginTransaction();

    //a. Cari user berdasarkan nomor HP yang sudah dinormalisasi
    $stmtUser = $pdo->prepare("SELECT user_id, role 
                                     FROM users 
                                     WHERE phone = :phone");
    $stmtUser->execute(['phone' => $phone]);
    $user = $stmtUser->fetch();

    if ($user) {
        // Jika nomor terdaftar bukan sebagai customer (misal admin), batalkan transaksi
        if ($user['role'] !== 'customer') {
            $pdo->rollBack();
            json_error('VALIDATION_ERROR', 'Nomor HP ini tidak dapat digunakan untuk pemesanan', 422);
        }
        $customerId = (int) $user['user_id'];
    } else {
        $stmtNewUser = $pdo->prepare("INSERT INTO users (role, full_name, phone) 
                                            VALUES ('customer', :full_name, :phone) 
                                            RETURNING user_id");
        $stmtNewUser->execute([
            'full_name' => $fullName,
            'phone' => $phone
        ]);
        $customerId = (int) $stmtNewUser->fetchColumn();
    }

    //b. Ambil data device
    $stmtDevice = $pdo->prepare("SELECT device_id, price_per_hour, status 
                                       FROM device 
                                       WHERE device_id = :device_id");
    $stmtDevice->execute(['device_id' => $deviceId]);
    $device = $stmtDevice->fetch();

    if (!$device) {
        $pdo->rollBack();
        json_error('NOT_FOUND', 'Device sedang dalam perbaikan (Maintenance) dan tidak dapat dipesan', 404);
    }

    if ($device['status'] === 'Maintenance') {
        $pdo->rollBack();
        json_error('DEVICE_MAINTENANCE', 'Device sedang dalam perbaikan dan tidak dapat dipesan', 409);
    }

    //c. Insert ke tabel booking (booking_channel selalu 'Online')
    $stmtBooking = $pdo->prepare("INSERT INTO booking (customer_id, booking_channel, payment_method) 
                                        VALUES (:customer_id, 'Online', :payment_method)
                                        RETURNING booking_id, booking_code");
    $stmtBooking->execute([
        'customer_id' => $customerId,
        'payment_method' => $paymentMethod
    ]);
    $bookingRow = $stmtBooking->fetch();
    $bookingId = (int) $bookingRow['booking_id'];
    $bookingCode = $bookingRow['booking_code'];

    //d. Hitung harga di sisi server & insert ke tabel rental
    //package_id dan rental_status menggunakan nilai bawaan (DEFAULT) dari database
    $pricePerHour = (float) $device['price_per_hour'];
    $totalCost = $durationHours * $pricePerHour;

    $stmtRental = $pdo->prepare("
        INSERT INTO rental (booking_id, device_id, start_time, duration_hours, end_time, price_per_hour, total_cost) 
        VALUES (:booking_id, :device_id, :start_time, :duration_hours, :end_time, :price_per_hour, :total_cost)
        RETURNING rental_status");
    $stmtRental->execute([
        'booking_id' => $bookingId,
        'device_id' => $deviceId,
        'start_time' => $startTimeDb,
        'duration_hours' => $durationHours,
        'end_time' => $endTimeDb,
        'price_per_hour' => $pricePerHour,
        'total_cost' => $totalCost
    ]);
    $rentalStatus = $stmtRental->fetchColumn();

    //Menyelesaikan transaksi
    $pdo->commit();

    //Kirim respons sukses dengan status 201 created
    json_response([
        'success' => true,
        'data' => [
            'booking_code' => $bookingCode,
            'device_id' => $deviceId,
            'start_time' => $startDt->format('Y-m-d\TH:i:s'),
            'end_time' => $endDt->format('Y-m-d\TH:i:s'),
            'duration_hours' => $durationHours,
            'price_per_hour' => $pricePerHour,
            'total_cost' => $totalCost,
            'rental_status' => $rentalStatus,
            'payment_method' => $paymentMethod
        ]
    ], 201);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Booking Create API Error: " . $e->getMessage());
    json_error('SERVER_ERROR', 'Terjadi kesalahan internal pada server', 500);
}
