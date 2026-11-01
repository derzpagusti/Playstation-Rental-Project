<?php

require __DIR__ . '/../../../includes/bootstrap.php';
/** @var PDO $pdo */

// 1. Pastikan metode HTTP adalah POST (405)
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('METHOD_NOT_ALLOWED', 'Metode HTTP tidak diizinkan. Gunakan metode POST', 405);
}

// 2. Baca JSON body (400 jika bukan JSON valid)
$input = read_json_body();

$rawUsername = $input['username'] ?? null;
$password = $input['password'] ?? null;

// 3. Validasi tipe data dan panjang wajar (422)
if (!is_string($rawUsername) || !is_string($password)) {
    json_error('VALIDATION_ERROR', 'Username dan password harus berupa teks', 422);
}

$username = trim($rawUsername);
$userLen = mb_strlen($username);
$passLen = strlen($password);

if ($userLen < 1 || $userLen > 50 || $passLen < 1 || $passLen > 200) {
    json_error('VALIDATION_ERROR', 'Username dan password wajib diisi dengan panjang yang wajar', 422);
}

try {
    // 4. Cari user admin/owner berdasarkan username (case-insensitive)
    $stmt = $pdo->prepare("SELECT user_id, full_name, role, password_hash
                           FROM users
                           WHERE lower(username) = lower(:username)
                             AND role IN ('admin', 'owner')");
    $stmt->execute(['username' => $username]);
    $user = $stmt->fetch();

    // Dummy hash bcrypt untuk menjaga waktu respons tetap mirip jika username tidak ditemukan
    $dummyHash = '$2y$12$Fctyqx33xXy4/RRTTRkdheqD22IqSznpEjJTtySlLmZLGBOJG7oZC';
    $hashToVerify = $user ? (string) $user['password_hash'] : $dummyHash;

    if (!$user || !password_verify($password, $hashToVerify)) {
        json_error('INVALID_CREDENTIALS', 'Username atau password salah', 401);
    }

    // 5. Regenerasi session ID untuk mencegah session fixation
    session_regenerate_id(true);

    $authData = [
        'user_id'   => (int) $user['user_id'],
        'full_name' => $user['full_name'],
        'role'      => $user['role']
    ];

    $_SESSION['auth'] = $authData;

    // 6. Kirim respons sukses tanpa password_hash
    json_response([
        'success' => true,
        'data'    => $authData
    ]);

} catch (PDOException $e) {
    error_log("Admin Login API Error: " . $e->getMessage());
    json_error('SERVER_ERROR', 'Terjadi kesalahan internal pada server', 500);
}