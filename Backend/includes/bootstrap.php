<?php

require_once __DIR__ . '/env.php';
loadEnv(dirname(__DIR__) . '/.env');

$appDebug = filter_var($_ENV['APP_DEBUG'] ?? false, FILTER_VALIDATE_BOOLEAN);
ini_set('display_errors', $appDebug ? '1' : '0');
ini_set('display_startup_errors', $appDebug ? '1' : '0');

define('BASE_PATH', dirname(__DIR__));
$uploadPath = trim($_ENV['UPLOAD_PATH'] ?? 'uploads', '/');
define('UPLOAD_DIR', BASE_PATH . '/' . $uploadPath);

$allowedOriginStr = $_ENV['CORS_ALLOWED_ORIGINS'] ?? '';

$allowedOrigins = array_map('trim', explode(',', $allowedOriginStr));
$httpOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($httpOrigin !== '' && in_array($httpOrigin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $httpOrigin");
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Allow-Headers: Content-Type");
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Vary: Origin");
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$sessionLifeTime = (int) ($_ENV['SESSION_LIFETIME'] ?? 28800);
$appEnv = $_ENV['APP_ENV'] ?? 'local';
$isSecure = ($appEnv !== 'local');

session_set_cookie_params([
    'lifetime' => $sessionLifeTime,
    'path' => '/',
    'secure' => $isSecure,
    'httponly' => true,
    'samesite' => 'Lax',
]);

session_name('psm_session');
ini_set('session.gc_maxlifetime', (string) $sessionLifeTime);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/response.php';
require_once __DIR__ . '/db.php';