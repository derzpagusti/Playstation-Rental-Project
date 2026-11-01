<?php

require __DIR__ . '/../../../includes/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error('METHOD_NOT_ALLOWED', 'Metode HTTP tidak diizinkan. Gunakan metode GET', 405);
}

$auth = require_login(['admin', 'owner']);

json_response([
    'success' => true,
    'data'    => $auth
]);