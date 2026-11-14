<?php

require __DIR__ . '/../../../includes/bootstrap.php';
/** @var PDO $pdo */

// 1. Hanya menerima POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('METHOD_NOT_ALLOWED', 'Gunakan method POST', 405);
}

// 2. Baca json body
$input = read_json_body();

$rawPhone = $input['phone'] ?? null;
$password = $input['password'] ?? null;

// 3. Validasi tipe data
if (!is_string($rawPhone) || !is_string($password)) {
    json_error('VALIDATION_ERROR', 'Nomor HP dan password harus berupa teks', 422);
}

// 4. Normalisasi nomor telpon
$phone = normalize_phone($rawPhone);
$passLen = strlen($password);

if (!preg_match('/^08\d{8,13}$/', $phone) || $passLen < 1 || $passLen > 200) {
    json_error('VALIDATION_ERROR', 'Nomor HP dan password tidak valid', 422);
}

try {
    // 5. Cari customer berdasarkan nomor HP
    $stmt = $pdo->prepare(
        "SELECT
            user_id,
            role,
            full_name,
            phone,
            password_hash,
            address,
            identity_doc_verified
         FROM users
         WHERE phone = :phone
           AND role = 'customer'
         LIMIT 1"
    );
    $stmt->execute(['phone' => $phone]);
    $user = $stmt->fetch();

    // Dummy hash agar verifikasi tetap dilakukan ketika user tidak ditemukan
    $dummyHash = '$2y$12$Fctyqx33xXy4/RRTTRkdheqD22IqSznpEjJTtySlLmZLGBOJG7oZC';

    $hashToVerify = ($user && !empty($user['password_hash']) ? $user['password_hash'] : $dummyHash);
    $passwordValid = password_verify($password, $hashToVerify);

    if (!$user || empty($user['password_hash']) || !$passwordValid) {
        json_error('INVALID_CREDENTIALS', 'Nomor HP atau password salah', 401);
    }

    // 6.Regenerasi ID session
    session_regenerate_id(true);

    // 7. Simpan data autentikasi
    $authData = [
        'user_id' => (int) $user['user_id'],
        'full_name' => $user['full_name'],
        'role' => 'customer'
    ];

    $_SESSION['auth'] = $authData;

    // 8. Data tambahan frontend
    $profileComplete = !empty($user['phone']) && !empty($user['address']);
    $identityVerified = filter_var($user['identity_doc_verified'], FILTER_VALIDATE_BOOLEAN);

    // 9. Respons sukses tanpa password_hash
    json_response([
        'success' => true,
        'data' => [
            'user_id' => $authData['user_id'],
            'full_name' => $authData['full_name'],
            'role' => $authData['role'],
            'phone' => $user['phone'],
            'profile_complete' => $profileComplete,
            'identity_doc_verified' => $identityVerified
        ]
    ]);
} catch (PDOException $e) {
    error_log('Customer Login API Error: ' . $e->getMessage());
    json_error('SERVER_ERROR', 'Terjadi kesalahan internal pada server', 500);
}