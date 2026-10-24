-- Kode booking dibuat tetap (DEMO0001 dst.) supaya frontend bisa menguji
-- halaman lacak pesanan. Waktu memakai now(), jadi selalu relevan.

-- 1) Pesanan (header)
INSERT INTO booking (booking_code, customer_id, staff_id, booking_channel, created_at,
                     payment_method, payment_proof_url, payment_verified_at, paid_at,
                     deposit_type, deposit_value, deposit_returned_at)
VALUES ('DEMO0001',
        (SELECT user_id FROM users WHERE phone = '081234567890'),
        (SELECT user_id FROM users WHERE username = 'reza'),
        'WhatsApp', now() - INTERVAL '70 minutes',
        'QRIS', 'payment_proof/demo-0001.jpg',
        now() - INTERVAL '55 minutes', now() - INTERVAL '55 minutes',
        NULL, NULL, NULL),

       ('DEMO0002',
        (SELECT user_id FROM users WHERE phone = '082345678901'),
        (SELECT user_id FROM users WHERE username = 'admin'),
        'Walk-in', now() - INTERVAL '8 hours',
        'Cash', NULL,
        now() - INTERVAL '8 hours', now() - INTERVAL '8 hours',
        'Kartu Pelajar', 'Kartu Pelajar a.n. Sinta Dewi', NULL),

       ('DEMO0003',
        (SELECT user_id FROM users WHERE phone = '083456789012'),
        (SELECT user_id FROM users WHERE username = 'admin'),
        'Online', now() - INTERVAL '49 hours',
        'Transfer Bank', 'payment_proof/demo-0003.jpg',
        now() - INTERVAL '48 hours 10 minutes', now() - INTERVAL '48 hours 10 minutes',
        'SIM', 'SIM a.n. Rafi Pratama', now() - INTERVAL '46 hours'),

       ('DEMO0004',
        (SELECT user_id FROM users WHERE phone = '082345678901'),
        NULL,
        'Online', now() - INTERVAL '10 minutes',
        'QRIS', NULL, NULL, NULL, NULL, NULL, NULL),

       ('DEMO0005',
        (SELECT user_id FROM users WHERE phone = '083456789012'),
        NULL,
        'WhatsApp', now() - INTERVAL '30 minutes',
        'Cash', NULL, NULL, NULL, NULL, NULL, NULL);

-- 2) Console dalam tiap pesanan (detail)
--    pkg_hours : durasi paket yang dipakai (NULL = durasi bebas)
--    start_off : jam mulai relatif terhadap sekarang (negatif = sudah lewat)
--    *_ago     : berapa lama yang lalu kejadian itu terjadi (NULL = belum terjadi)
INSERT INTO rental (booking_id, device_id, package_id, start_time, duration_hours, end_time,
                    price_per_hour, total_cost, extra_hours, extra_cost, rental_status,
                    rented_at, overdue_at, returned_at,
                    condition_at_pickup, condition_at_return, condition_notes)
SELECT b.booking_id,
       d.device_id,
       p.package_id,
       now() + v.start_off,
       v.hours,
       now() + v.start_off + v.hours * INTERVAL '1 hour', v.price, v.total, v.extra_h, v.extra_c, v.status, now() - v.rented_ago, now() - v.overdue_ago, now() - v.returned_ago, v.cond_pick, v.cond_ret, v.cond_note
FROM (VALUES
    -- DEMO0001: dua console sekaligus. PS4 paket 3 jam + perpanjangan 1 jam
    -- (durasi 4 jam, 25.000 + 10.000). PS3 durasi bebas 2 jam
    ('DEMO0001', 'SN-PS4-001', 3, INTERVAL '-1 hour', 4, NULL, 35000, 1, 10000, 'Rented', INTERVAL '55 minutes', NULL, NULL, NULL, NULL, NULL), ('DEMO0001', 'SN-PS3-002', NULL, INTERVAL '-1 hour', 2, 8000, 16000, 0, 0, 'Rented', INTERVAL '55 minutes', NULL, NULL, NULL, NULL, NULL),
    -- DEMO0002: sudah lewat batas waktu
    ('DEMO0002', 'SN-PS3-001', NULL, INTERVAL '-8 hours', 5, 8000, 40000, 0, 0, 'Overdue', INTERVAL '7 hours 59 minutes', INTERVAL '3 hours', NULL, NULL, NULL, NULL),
    -- DEMO0003: sudah selesai, kondisi barang dicatat
    ('DEMO0003', 'SN-PS4-002', NULL, INTERVAL '-48 hours', 2, 10000, 20000, 0, 0, 'Returned', INTERVAL '48 hours 10 minutes', NULL, INTERVAL '46 hours', 'Good', 'Good', 'Slight scratch on the HDMI cable'),
    -- DEMO0004: booking nanti, bukti bayar belum ada
    ('DEMO0004', 'SN-PS4-001', NULL, INTERVAL '5 hours', 4, 10000, 40000, 0, 0, 'Booked', NULL, NULL, NULL, NULL, NULL, NULL),
    -- DEMO0005: paket 3 jam besok, bayar cash
    ('DEMO0005', 'SN-PS3-002', 3, INTERVAL '1 day', 3, NULL, 20000, 0, 0, 'Booked', NULL, NULL, NULL, NULL, NULL, NULL)
    ) AS v(code, serial, pkg_hours, start_off, hours, price, total, extra_h, extra_c, status, rented_ago, overdue_ago, returned_ago, cond_pick, cond_ret, cond_note)
    JOIN booking b
ON b.booking_code = v.code
    JOIN device d ON d.serial_number = v.serial
    LEFT JOIN rental_package p ON p.device_id = d.device_id
    AND p.duration_hours = v.pkg_hours
    AND p.is_active;