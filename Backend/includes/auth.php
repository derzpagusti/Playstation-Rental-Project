<?php

function require_login(array $roles = []): array
{
    if (empty($_SESSION['auth']) || !is_array($_SESSION['auth'])) {
        json_error('UNAUTHORIZED', 'Sesi tidak ditemukan. Silahkan login terlebih dahulu', 401);
    }

    $auth = $_SESSION['auth'];

    if ($roles !== [] && (!isset($auth['role']) || !in_array($auth['role'], $roles, true))) {
        json_error('FORBIDDEN', 'Anda tidak memiliki hak akses untuk tindakan ini', 403);
    }
    return $auth;
}