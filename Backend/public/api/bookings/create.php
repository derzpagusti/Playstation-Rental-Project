<?php

require __DIR__ . '/../../../includes/bootstrap.php';
/** @var PDO $pdo */

// 1. Memastikan metode harus POST dan baca JSON body
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('METHOD_NOT_ALLOWED', 'Metode HTTP tidak diizinkan. Gunakan metode POST', 405);
}

$auth = require_login(['customer']);

$customerId = filter_var($auth['user_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

if ($customerId === false || $customerId === null) {
    json_error('UNAUTHORIZED', 'Sesi pelanggan tidak valid', 401);
}

$input = read_json_body();

// c. Validasi start_time (Wajib, format YYYY-MM-DDTHH:MM:SS, maksimal 5 menit di masa lalu)
$timeZone = new DateTimeZone('Asia/Jakarta');

$startDt = new DateTimeImmutable('now', $timeZone);

// d. Validasi payment_method (Salah satu dari QRIS, Transfer Bank, Cash)
$paymentMethod = $input['payment_method'] ?? '';
$allowedMethods = ['QRIS', 'Cash'];
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
        json_error(
            'VALIDATION_ERROR',
            "Item pada indeks ke-{$index} harus berupa objek",
            422
        );
    }

    $deviceId = $item['device_id'] ?? null;

    if (!is_int($deviceId) || $deviceId < 1) {
        json_error(
            'VALIDATION_ERROR',
            'device_id pada setiap item harus berupa bilangan bulat minimal 1',
            422
        );
    }

    if (array_key_exists('duration_hours', $item)) {
        json_error(
            'VALIDATION_ERROR',
            'Gunakan duration_days untuk durasi sewa harian',
            422
        );
    }

    if (array_key_exists('package_id', $item)) {
        json_error('VALIDATION_ERROR', 'Sistem tidak lagi menggunakan paket rental', 422);
    }

    $durationDays = $item['duration_days'] ?? null;

    if (!is_int($durationDays) || $durationDays < 1 || $durationDays > 7) {
        json_error('VALIDATION_ERROR', "Durasi untuk device ID {$deviceId} harus 1-7 hari", 422);
    }

    $deviceIds[] = $deviceId;

    $validatedItems[] = [
        'device_id' => $deviceId,
        'duration_days' => $durationDays,
    ];
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
    expire_unpaid_bookings($pdo);

    $pdo->beginTransaction();

    $stmtUser = $pdo->prepare("SELECT user_id, role, full_name, phone, address, identity_doc_type, identity_doc_url, identity_doc_verified
                               FROM users
                               WHERE user_id = :customer_id
                               FOR UPDATE");
    $stmtUser->execute(['customer_id' => $customerId]);
    $user = $stmtUser->fetch();

    if (!$user || $user['role'] != 'customer') {
        $pdo->rollBack();
        json_error('FORBIDDEN', 'Akun tidak diizinkan melakukan pemesanan', 403);
    }

    // Pastikan profil data lengkap
    if (trim((string) $user['full_name']) === '' || trim((string) $user['phone']) === '' || trim((string) $user['address']) === '') {
        $pdo->rollBack();
        json_error('PROFILE_INCOMPLETE', 'Lengkapi nama, nomor telepon, dan alamat sebelum checkout', 422);
    }

    if (empty($user['identity_doc_type']) || empty($user['identity_doc_url'])) {
        $pdo->rollBack();
        json_error('IDENTITY_REQUIRED', 'Unggah dokumen identitas sebelum checkout', 422);
    }

    // Hanya boleh checkout setelah verifikasi identitas
    $isVerified = filter_var($user['identity_doc_verified'], FILTER_VALIDATE_BOOLEAN);

    if (!$isVerified) {
        $pdo->rollBack();
        json_error('IDENTITY_NOT_VERIFIED', 'Dokumen identitas belum diverifikasi admin', 403);
    }

    // Ambil alamat profil pada saat checkout
    $addressSnapshot = trim($user['address']);

    // Batasi jumlah booking aktif
    $stmtActive = $pdo->prepare(
        "SELECT COUNT(DISTINCT b.booking_id)
     FROM booking b
     JOIN payment p
        ON p.booking_id = b.booking_id
     JOIN rental r
        ON r.booking_id = b.booking_id
     WHERE b.customer_id = :customer_id
       AND r.rental_status IN (
           'Booked', 'Rented', 'Overdue'
       )
       AND p.payment_status NOT IN (
           'Expired', 'Rejected', 'Cancelled'
       )
       AND (
           p.payment_status <> 'Pending'
           OR p.payment_expires_at IS NULL
           OR p.payment_expires_at > statement_timestamp()
       )"
    );

    $stmtActive->execute(['customer_id' => $customerId]);
    $activeBookings = (int) $stmtActive->fetchColumn();

    if ($activeBookings >= $maxActiveBookings) {
        $pdo->rollBack();
        json_error('BOOKING_LIMIT_REACHED', "Pelanggan sudah memiliki {$maxActiveBookings} booking aktif", 429);
    }

    $paymentWindow = filter_var(
        env('PAYMENT_WINDOW_MINUTES', 5),
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 1]]
    );

    if ($paymentWindow === false) {
        throw new RuntimeException('PAYMENT_WINDOW_MINUTES harus berupa bilangan bulat positif');
    }

    $windowMinutes = $paymentMethod === 'Cash' ? null : $paymentWindow;

    $stmtBooking = $pdo->prepare("INSERT INTO booking (customer_id, booking_channel, address_snapshot)
                                  VALUES (:customer_id, 'Online', :address_snapshot)
                                  RETURNING booking_id, booking_code");
    $stmtBooking->execute([
        'customer_id' => $customerId,
        'address_snapshot' => $addressSnapshot,
    ]);

    $bookingRow = $stmtBooking->fetch();

    if (!$bookingRow) {
        throw new RuntimeException('Gagal membuat booking');
    }

    $bookingId = (int) $bookingRow['booking_id'];
    $bookingCode = $bookingRow['booking_code'];

    $stmtPayment = $pdo->prepare(
        "INSERT INTO payment (booking_id, payment_method, payment_status, payment_expires_at)
         VALUES (:booking_id, :payment_method, 'Pending', clock_timestamp() + CAST(:window AS INTEGER) * INTERVAL '1 minute')
    RETURNING
        payment_status,
        to_char(
            payment_expires_at,
            'YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM'
        ) AS payment_expires_at,
        CASE
            WHEN payment_expires_at IS NULL THEN NULL
            ELSE GREATEST(
                0,
                CEIL(EXTRACT(EPOCH FROM (
                    payment_expires_at - clock_timestamp()
                )))
            )::INTEGER
        END AS seconds_left"
    );

    $stmtPayment->bindValue(':booking_id', $bookingId, PDO::PARAM_INT);
    $stmtPayment->bindValue(':payment_method', $paymentMethod, PDO::PARAM_STR);
    $stmtPayment->bindValue(':window', $windowMinutes, $windowMinutes === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
    $stmtPayment->execute();
    $payment = $stmtPayment->fetch();

    if (!$payment) {
        throw new RuntimeException('Gagal membuat data pembayaran');
    }

    // Menyiapkan prepared statement untuk paket dan insert rental
    $stmtInsertRental = $pdo->prepare("INSERT INTO rental (booking_id, device_id, start_time, duration_hours, end_time, price_per_day, total_cost)
                                       VALUES (:booking_id, :device_id, :start_time, :duration_hours, :end_time, :price_per_day, :total_cost)
                                       RETURNING rental_status");
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

        // Hitung harga sewa berdasarkan durasi harian.
        $durationDays = $item['duration_days'];
        $itemDuration = $durationDays * 24;
        $pricePerDay = (float) $device['price_per_day'];
        $itemTotal = $durationDays * $pricePerDay;

        // Tentukan waktu selesai penyewaan.
        $itemEndDt = $startDt->modify("+{$itemDuration} hours");
        $itemEndTimeDb = $itemEndDt->format('Y-m-d H:i:sP');

        // 5) Cek apakah jadwal bentrok dengan rental lain yang belum Returned (409 SLOT_TAKEN)
        if (!slot_is_free($pdo, $devId, $startTimedb, $itemEndTimeDb)) {
            $pdo->rollBack();
            json_error('SLOT_TAKEN', "Jadwal untuk device_id {$devId} pada rentang waktu tersebut sudah terisi", 409);
        }

        // 6) Insert baris rental

        $stmtInsertRental->execute([
            'booking_id' => $bookingId,
            'device_id' => $devId,
            'start_time' => $startTimedb,
            'duration_hours' => $itemDuration,
            'end_time' => $itemEndTimeDb,
            'price_per_day' => $pricePerDay,
            'total_cost' => $itemTotal
        ]);

        $rentalStatus = $stmtInsertRental->fetchColumn();

        $grandTotal += $itemTotal;

        $responseItems[] = [
            'device_id' => $devId,
            'duration_days' => $durationDays,
            'duration_hours' => $itemDuration,
            'price_per_day' => $pricePerDay,
            'end_time' => $itemEndDt->format(
                'Y-m-d\TH:i:sP'
            ),
            'total_cost' => $itemTotal,
            'rental_status' => $rentalStatus
        ];

    }

    // Menyelesaikan transaksi
    $pdo->commit();

    // Kirim respons sukses dengan status 201 Created
    json_response([
        'success' => true,
        'data' => [
            'booking_code'   => $bookingCode,
            'start_time' => $startDt->format('Y-m-d\TH:i:sP'),
            'payment_method' => $paymentMethod,
            'total_cost'     => $grandTotal,
            'items'          => $responseItems,
            'payment' => [
                'status' => $payment['payment_status'],
                'expires_at' => $payment['payment_expires_at'],
                'seconds_left' => $payment['payment_expires_at'] !== null ? (int) $payment['seconds_left'] : null,
            ]
        ]
    ], 201);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Booking Create API Error: " . $e->getMessage());
    json_error('SERVER_ERROR', 'Terjadi kesalahan internal pada server', 500);
}