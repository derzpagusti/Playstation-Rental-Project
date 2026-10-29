<?php

require __DIR__ . '/../../../includes/bootstrap.php';
/** @var PDO $pdo */

// 1. Memastikan metode harus POST dan baca JSON body
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('METHOD_NOT_ALLOWED', 'Metode HTTP tidak diizinkan. Gunakan metode POST', 405);
}

$input = read_json_body();

// 2. Validasi semua field input sebelum memasukkan ke database
// a. Validasi full_name (Wajib, panjang 1-100 setelah trim)
$rawName = $input['full_name'] ?? '';
if (!is_string($rawName)) {
    json_error('VALIDATION_ERROR', 'Nama lengkap harus berupa teks', 422);
}
$fullName = trim($rawName);
$nameLen = mb_strlen($fullName);
if ($nameLen < 1 || $nameLen > 100) {
    json_error('VALIDATION_ERROR', 'Nama lengkap wajib diisi 1-100 karakter', 422);
}

// b. Validasi phone (Wajib, setelah normalize harus cocok ^08\d{8,13}$)
$rawPhone = $input['phone'] ?? '';
if (!is_string($rawPhone)) {
    json_error('VALIDATION_ERROR', 'Nomor HP harus berupa teks', 422);
}
$phone = normalize_phone($rawPhone);
if (!preg_match('/^08\d{8,13}$/', $phone)) {
    json_error('VALIDATION_ERROR', 'Nomor HP tidak valid. Gunakan format 10-15 digit diawali 08', 422);
}

// c. Validasi start_time (Wajib, format YYYY-MM-DDTHH:MM:SS, maksimal 5 menit di masa lalu)
$startTimeStr = $input['start_time'] ?? '';
if (!is_string($startTimeStr)) {
    json_error('VALIDATION_ERROR', 'start_time harus berupa teks', 422);
}
$startDt = DateTimeImmutable::createFromFormat('Y-m-d\TH:i:s', $startTimeStr);
if ($startDt === false || $startDt->format('Y-m-d\TH:i:s') !== $startTimeStr) {
    json_error('VALIDATION_ERROR', 'Format start_time tidak valid. Gunakan YYYY-MM-DDTHH:MM:SS', 422);
}

$fiveMinutesAgo = (new DateTimeImmutable())->modify('-5 minutes');
if ($startDt < $fiveMinutesAgo) {
    json_error('VALIDATION_ERROR', 'Waktu mulai (start_time) tidak boleh lebih dari 5 menit di masa lalu', 422);
}

// d. Validasi payment_method (Salah satu dari QRIS, Transfer Bank, Cash)
$paymentMethod = $input['payment_method'] ?? '';
$allowedMethods = ['QRIS', 'Transfer Bank', 'Cash'];
if (!is_string($paymentMethod) || !in_array($paymentMethod, $allowedMethods, true)) {
    json_error('VALIDATION_ERROR', 'Metode pembayaran harus salah satu dari QRIS, Transfer Bank, atau Cash', 422);
}

// e. Validasi daftar items (1 sampai 4 item)
$rawItems = $input['items'] ?? null;
if (!is_array($rawItems) || !array_is_list($rawItems) || count($rawItems) === 0 || count($rawItems) > 4) {
    json_error('VALIDATION_ERROR', 'items harus berupa array daftar dan berisi 1 sampai 4 item', 422);
}

$validatedItems = [];
$deviceIds = [];

foreach ($rawItems as $index => $item) {
    if (!is_array($item) || array_is_list($item)) {
        json_error('VALIDATION_ERROR', "Item pada indeks ke-{$index} harus berupa objek", 422);
    }

    $deviceId = filter_var($item['device_id'] ?? null, FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1]
    ]);
    if ($deviceId === false) {
        json_error('VALIDATION_ERROR', 'device_id pada setiap item harus berupa bilangan bulat minimal 1', 422);
    }

    $deviceIds[] = $deviceId;

    // Cek apakah item memiliki duration_hours atau package_id (tepat salah satu)
    $hasDuration = array_key_exists('duration_hours', $item) && $item['duration_hours'] !== null;
    $hasPackage = array_key_exists('package_id', $item) && $item['package_id'] !== null;

    if ($hasDuration === $hasPackage) {
        json_error('VALIDATION_ERROR', "Item dengan ID {$deviceId} harus memilih tepat salah satu duration_hours atau package_id", 422);
    }

    $cleanItem = ['device_id' => $deviceId];

    if ($hasDuration) {
        $durationHours = filter_var($item['duration_hours'], FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1, 'max_range' => 168]
        ]);
        if ($durationHours === false) {
            json_error('VALIDATION_ERROR', "duration_hours untuk device ID {$deviceId} harus berupa bilangan bulat 1-168", 422);
        }
        $cleanItem['duration_hours'] = $durationHours;
        $cleanItem['package_id'] = null;
    } else {
        $packageId = filter_var($item['package_id'], FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1]
        ]);
        if ($packageId === false) {
            json_error('VALIDATION_ERROR', "package_id untuk device ID {$deviceId} harus berupa angka bulat minimal 1", 422);
        }
        $cleanItem['package_id'] = $packageId;
        $cleanItem['duration_hours'] = null;
    }

    $validatedItems[] = $cleanItem;
}

// Cek device_id ganda
if (count($deviceIds) !== count(array_unique($deviceIds))) {
    json_error('VALIDATION_ERROR', 'Tidak boleh ada device_id yang duplikat dalam satu pesanan', 422);
}

// Urutkan item menurut device_id naik untuk mencegah deadlock saat lock_device()
usort($validatedItems, fn(array $a, array $b): int => $a['device_id'] <=> $b['device_id']);

// Format waktu mulai untuk database
$startTimedb = $startDt->format('Y-m-d H:i:sP');
$maxActiveBookings = (int) (env('BOOKING_MAX_ACTIVE', 2) ?: 2);

// 3. Transaksi Database
try {
    $pdo->beginTransaction();

    // a. Cari user berdasarkan nomor HP dan kunci barisnya (FOR UPDATE)
    $stmtUser = $pdo->prepare("SELECT user_id, role 
                               FROM users 
                               WHERE phone = :phone 
                               FOR UPDATE");
    $stmtUser->execute(['phone' => $phone]);
    $user = $stmtUser->fetch();

    if ($user) {
        if ($user['role'] !== 'customer') {
            $pdo->rollBack();
            json_error('VALIDATION_ERROR', 'Nomor HP ini tidak dapat digunakan untuk pemesanan', 422);
        }
        $customerId = (int) $user['user_id'];

        // b. Cek batas pesanan aktif untuk customer yang sudah ada
        $stmtActive = $pdo->prepare("SELECT COUNT(DISTINCT b.booking_id)
                                     FROM booking b
                                     JOIN rental r ON r.booking_id = b.booking_id
                                     WHERE b.customer_id = :customer_id
                                       AND r.rental_status <> 'Returned'");
        $stmtActive->execute(['customer_id' => $customerId]);
        $activeBookings = (int) $stmtActive->fetchColumn();

        if ($activeBookings >= $maxActiveBookings) {
            $pdo->rollBack();
            json_error(
                'BOOKING_LIMIT_REACHED',
                "Nomor HP ini sudah memiliki {$maxActiveBookings} pesanan aktif yang belum selesai",
                429
            );
        }
    } else {
        $stmtNewUser = $pdo->prepare("INSERT INTO users (role, full_name, phone) 
                                      VALUES ('customer', :full_name, :phone) 
                                      RETURNING user_id");
        $stmtNewUser->execute([
            'full_name' => $fullName,
            'phone'     => $phone
        ]);
        $customerId = (int) $stmtNewUser->fetchColumn();
    }

    // c. Insert ke tabel booking (booking_channel selalu 'Online')
    $stmtBooking = $pdo->prepare("INSERT INTO booking (customer_id, booking_channel, payment_method) 
                                  VALUES (:customer_id, 'Online', :payment_method)
                                  RETURNING booking_id, booking_code");
    $stmtBooking->execute([
        'customer_id'    => $customerId,
        'payment_method' => $paymentMethod
    ]);
    $bookingRow = $stmtBooking->fetch();
    $bookingId = (int) $bookingRow['booking_id'];
    $bookingCode = $bookingRow['booking_code'];

    // Menyiapkan prepared statement untuk paket dan insert rental
    $stmtGetPackage = $pdo->prepare("SELECT package_id, duration_hours, package_price 
                                     FROM rental_package 
                                     WHERE package_id = :package_id 
                                       AND device_id = :device_id 
                                       AND is_active = true");

    $stmtInsertRental = $pdo->prepare("INSERT INTO rental (
                                           booking_id, device_id, package_id, start_time, 
                                           duration_hours, end_time, price_per_hour, total_cost
                                       ) VALUES (
                                           :booking_id, :device_id, :package_id, :start_time, 
                                           :duration_hours, :end_time, :price_per_hour, :total_cost
                                       ) RETURNING rental_status");

    $responseItems = [];
    $grandTotal = 0;

    foreach ($validatedItems as $item) {
        $devId = $item['device_id'];

        // 1) Kunci baris device dan cek keberadaannya (404)
        $device = lock_device($pdo, $devId);
        if (!$device) {
            $pdo->rollBack();
            json_error('NOT_FOUND', "Device dengan ID {$devId} tidak ditemukan", 404);
        }

        // 2) Cek apakah device sedang Maintenance (409)
        if ($device['status'] === 'Maintenance') {
            $pdo->rollBack();
            json_error('DEVICE_MAINTENANCE', "Device dengan ID {$devId} sedang dalam Maintenance (Perbaikan)", 409);
        }

        // 3) Cek apakah device masih ditahan penyewa sebelumnya / Overdue (409)
        if (device_is_held($pdo, $devId)) {
            $pdo->rollBack();
            json_error('DEVICE_OVERDUE', "Device dengan ID {$devId} masih belum dikembalikan oleh penyewa sebelumnya", 409);
        }

        // 4) Hitung durasi, harga, dan end_time terlebih dahulu sebelum cek slot_is_free()
        if ($item['package_id'] === null) {
            $itemDuration = $item['duration_hours'];
            $pricePerHour = (float) $device['price_per_hour'];
            $itemTotal = $itemDuration * $pricePerHour;
            $packageId = null;
            $resPrice = $pricePerHour;
        } else {
            $pkgId = $item['package_id'];
            $stmtGetPackage->execute([
                'package_id' => $pkgId,
                'device_id'  => $devId
            ]);
            $package = $stmtGetPackage->fetch();

            if (!$package) {
                $pdo->rollBack();
                json_error('NOT_FOUND', "Paket dengan ID {$pkgId} tidak ditemukan", 404);
            }

            $itemDuration = (int) $package['duration_hours'];
            $itemTotal = (float) $package['package_price'];
            $packageId = (int) $package['package_id'];
            $pricePerHour = null;
            $resPrice = null;
        }

        $itemEndDt = $startDt->modify("+{$itemDuration} hours");
        $itemEndTimeDb = $itemEndDt->format('Y-m-d H:i:sP');

        // 5) Cek apakah jadwal bentrok dengan rental lain yang belum Returned (409 SLOT_TAKEN)
        if (!slot_is_free($pdo, $devId, $startTimedb, $itemEndTimeDb)) {
            $pdo->rollBack();
            json_error('SLOT_TAKEN', "Jadwal untuk device_id {$devId} pada rentang waktu tersebut sudah terisi", 409);
        }

        // 6) Insert baris rental
        $stmtInsertRental->execute([
            'booking_id'     => $bookingId,
            'device_id'      => $devId,
            'package_id'     => $packageId,
            'start_time'     => $startTimedb,
            'duration_hours' => $itemDuration,
            'end_time'       => $itemEndTimeDb,
            'price_per_hour' => $pricePerHour,
            'total_cost'     => $itemTotal
        ]);
        $rentalStatus = $stmtInsertRental->fetchColumn();

        $grandTotal += $itemTotal;

        $responseItems[] = [
            'device_id'      => $devId,
            'package_id'     => $packageId,
            'duration_hours' => $itemDuration,
            'price_per_hour' => $resPrice,
            'end_time'       => $itemEndDt->format('Y-m-d\TH:i:s'),
            'total_cost'     => $itemTotal,
            'rental_status'  => $rentalStatus
        ];
    }

    // Menyelesaikan transaksi
    $pdo->commit();

    // Kirim respons sukses dengan status 201 Created
    json_response([
        'success' => true,
        'data' => [
            'booking_code'   => $bookingCode,
            'start_time'     => $startDt->format('Y-m-d\TH:i:s'),
            'payment_method' => $paymentMethod,
            'total_cost'     => $grandTotal,
            'items'          => $responseItems
        ]
    ], 201);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Booking Create API Error: " . $e->getMessage());
    json_error('SERVER_ERROR', 'Terjadi kesalahan internal pada server', 500);
}