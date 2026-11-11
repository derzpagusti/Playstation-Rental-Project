<?php

require __DIR__ . "/../../../../includes/bootstrap.php";

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    json_error('METHOD_NOT_ALLOWED', 'Method HTTP tidak diizinkan. Gunakan GET', 405);
}

require_login(['admin', 'owner']);

$where = [];
$params = [];

if (isset($_GET['status'])) {
    $status = $_GET['status'];
    $allowedStatuses = ['Booked', 'Rented', 'Overdue', 'Returned', 'Cancelled'];
    if (!is_string($status) || !in_array($status, $allowedStatuses, true)) {
        json_error('VALIDATION_ERROR', 'Parameter status harus salah satu dari Booked, Rented, Overdue, atau Returned', 422);
    }
    $where[] = 'EXISTS (SELECT 1 FROM rental r_sub WHERE r_sub.booking_id = b.booking_id AND r_sub.rental_status = :status)';
    $params['status'] = $status;
}

if (isset($_GET['payment_status'])) {
    $paymentStatus = $_GET['payment_status'];

    $allowedPaymentStatuses = [
        'Pending',
        'AwaitingVerification',
        'Paid',
        'Expired',
        'Rejected',
        'Cancelled',
    ];

    if (!is_string($paymentStatus)
        || !in_array($paymentStatus, $allowedPaymentStatuses, true)) {
        json_error(
            'VALIDATION_ERROR',
            'Parameter payment_status tidak valid',
            422
        );
    }

    $where[] = 'b.payment_status = :payment_status';
    $params['payment_status'] = $paymentStatus;
}

if (isset($_GET['payment_verified'])) {
    $pv = $_GET['payment_verified'];
    if ($pv !== 'true' && $pv !== 'false') {
        json_error('VALIDATION_ERROR', 'Parameter status harus salah satu dari Booked, Rented, Overdue, Returned, atau Cancelled', 422);
    }
    if ($pv === 'true') {
        $where[] = 'b.payment_verified_at IS NOT NULL';
    } else {
        $where[] = 'b.payment_verified_at IS NULL';
    }
}

if (isset($_GET['search'])) {
    if (!is_string($_GET['search'])) {
        json_error('VALIDATION_ERROR', 'Parameter search harus berupa teks', 422);
    }
    $search = trim($_GET['search']);
    if (mb_strlen($search) > 50) {
        json_error('VALIDATION_ERROR', 'Parameter search maksimal 50 karakter', 422);
    }
    if ($search !== '') {
        $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search);
        $where[] = "(b.booking_code LIKE :search_code
                    OR u.full_name ILIKE :search_name
                    OR u.phone LIKE :search_phone)";
        $params['search_code'] = '%' . strtoupper($escaped) . '%';
        $params['search_name'] = '%' . $escaped . '%';
        $params['search_phone'] = '%' . $escaped . '%';
    }
}

$page = 1;
if (isset($_GET['page'])) {
    $page = filter_var($_GET['page'], FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1]
    ]);
    if ($page === false) {
        json_error('VALIDATION_ERROR', 'Parameter page harus bilangan bulat minimal 1', 422);
    }
}

$perPage = 20;
if (isset($_GET['per_page'])) {
    $perPage = filter_var($_GET['per_page'], FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1, 'max_range' => 100]
    ]);
    if ($perPage === false) {
        json_error('VALIDATION_ERROR', 'Parameter per_page harus bilangan bulat antara 1 sampai 100', 422);
    }
}

$offset = ($page - 1) * $perPage;
$whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

try {
    expire_unpaid_bookings($pdo);
    mark_overdue($pdo);

    $countSql = "SELECT COUNT(DISTINCT b.booking_id)
                 FROM booking b
                 JOIN users u ON u.user_id = b.customer_id
                 JOIN rental r ON r.booking_id = b.booking_id 
                 $whereSql";
    $stmtCount = $pdo->prepare($countSql);
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    $listSql = "SELECT b.booking_id,
                       b.booking_code,
                       u.full_name,
                       u.phone,
                       b.booking_channel,
                       to_char(b.created_at, 'YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM') AS created_at,
                       b.payment_method,
                       b.payment_status,
                            to_char(
                                b.payment_expires_at,
                                'YYYY-MM-DD\"T\"HH24:MI:SSTZH:TZM'
                            ) AS payment_expires_at,
                            CASE
                                WHEN b.payment_expires_at IS NULL THEN NULL
                                WHEN b.payment_status = 'Pending' THEN
                                    GREATEST(
                                        0,
                                        CEIL(EXTRACT(EPOCH FROM (
                                            b.payment_expires_at - statement_timestamp()
                                        )))
                                    )::integer
                                ELSE 0
                            END AS seconds_left,
                       (b.payment_proof_url IS NOT NULL) AS payment_proof_uploaded,
                       (b.payment_verified_at IS NOT NULL) AS payment_verified,
                       COUNT(*) AS items_count,
                       SUM(r.total_cost) AS total_cost,
                       SUM(CASE WHEN r.rental_status = 'Booked' THEN 1 ELSE 0 END) AS count_booked,
                       SUM(CASE WHEN r.rental_status = 'Rented' THEN 1 ELSE 0 END) AS count_rented,
                       SUM(CASE WHEN r.rental_status = 'Overdue' THEN 1 ELSE 0 END) AS count_overdue,
                       SUM(CASE WHEN r.rental_status = 'Returned' THEN 1 ELSE 0 END) AS count_returned,
                       SUM(CASE WHEN r.rental_status = 'Cancelled' THEN 1 ELSE 0 END) AS count_cancelled
                FROM booking b
                JOIN users u ON u.user_id = b.customer_id
                JOIN rental r ON r.booking_id = b.booking_id
                $whereSql
                GROUP BY b.booking_id, b.created_at, u.user_id
                ORDER BY b.created_at DESC, b.booking_id DESC
                LIMIT :limit OFFSET :offset";
    $stmtList = $pdo->prepare($listSql);
    foreach ($params as $key => $val) {
        $stmtList->bindValue(':' . $key, $val);
    }
    $stmtList->bindValue(':limit', $perPage, PDO::PARAM_INT);
    $stmtList->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmtList->execute();

    $rows = $stmtList->fetchAll();
    $data = [];

    foreach ($rows as $row) {
        $data[] = [
            'booking_id' => (int)$row['booking_id'],
            'booking_code' => $row['booking_code'],
            'full_name' => $row['full_name'],
            'phone' => $row['phone'],
            'booking_channel' => $row['booking_channel'],
            'created_at' => $row['created_at'],
            'payment_method' => $row['payment_method'],
            'payment_status' => $row['payment_status'],
            'payment_expires_at' => $row['payment_expires_at'],
            'seconds_left' => $row['seconds_left'] !== null ? (int) $row['seconds_left'] : null,
            'payment_proof_uploaded' => (bool)$row['payment_proof_uploaded'],
            'payment_verified' => (bool)$row['payment_verified'],
            'items_count' => (int)$row['items_count'],
            'total_cost' => (float)$row['total_cost'],
            'status_count' => [
                'Booked' => (int) $row['count_booked'],
                'Rented' => (int) $row['count_rented'],
                'Overdue' => (int) $row['count_overdue'],
                'Returned' => (int) $row['count_returned'],
                'Cancelled' => (int) $row['count_cancelled'],
            ],
        ];
    }

    json_response([
        'success' => true,
        'data' => $data,
        'meta' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
        ],
    ]);
} catch (PDOException $e) {
    error_log("Admin Booking List API Error: " . $e->getMessage());
    json_error('SERVER_ERROR', 'Terjadi kesalahan internal pada server', 500);
}