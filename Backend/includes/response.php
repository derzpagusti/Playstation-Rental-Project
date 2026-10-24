<?php

function json_response($data, $status = 200)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    $json = json_encode($data, JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        http_response_code(500);
        $json = '{"success":false,"code":"SERVER_ERROR","message":"Failed to encode response"}';
    }
    echo $json;
    exit;
}

function json_error($code, $message, $status)
{
    $error_data = [
        'success' => false,
        'code' => $code,
        'message' => $message,
    ];
    json_response($error_data, $status);
}