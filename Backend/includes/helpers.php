<?php

function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        json_error('BAD_REQUEST', 'Format request tidak valid. Body harus berupa JSON', 400);
    }
    return $data;
}

function normalize_phone(string $phone): string
{
    $cleaned = preg_replace('/\D+/', '', $phone);

    if (str_starts_with($cleaned, '62')) {
        $cleaned = '0' . substr($cleaned, 2);
    }
    return $cleaned;
}