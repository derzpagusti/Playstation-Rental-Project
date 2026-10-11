-- Kode booking dibuat tetap (DEMO0001 dst.) supaya frontend bisa
-- menguji halaman lacak pesanan dengan kode yang sudah diketahui.
-- Waktu memakai now(), jadi selalu relevan kapan pun seeder dijalankan.

-- DEMO0001: Budi, PS4-01, paket 3 jam + perpanjangan 1 jam, sedang berjalan
INSERT INTO rental (booking_code, customer_id, device_id, staff_id, package_id, booking_channel,
                    created_at, start_time, duration_hours, end_time, price_per_hour, total_cost,
                    rental_status, payment_method, payment_proof_url, payment_verified_at, paid_at)
VALUES ('DEMO0001',
        (SELECT customer_id FROM customer WHERE phone = '081234567890'),
        (SELECT device_id FROM device WHERE serial_number = 'SN-PS4-001'),
        (SELECT staff_id FROM staff WHERE username = 'reza'),
        (SELECT p.package_id
         FROM rental_package p
                  JOIN device d ON d.device_id = p.device_id
         WHERE d.serial_number = 'SN-PS4-001'
           AND p.duration_hours = 3),
        'WhatsApp',
        now() - INTERVAL '70 minutes', now() - INTERVAL '1 hour', 4, now() + INTERVAL '3 hours',
        NULL, 35000, -- 25.000 paket + 10.000 perpanjangan
        'Rented', 'QRIS', 'payment_proof/demo-0001.jpg',
        now() - INTERVAL '55 minutes', now() - INTERVAL '55 minutes');

-- DEMO0002: Sinta, PS3-01, durasi bebas 5 jam, sudah lewat batas waktu (Overdue)
INSERT INTO rental (booking_code, customer_id, device_id, staff_id, booking_channel,
                    created_at, start_time, duration_hours, end_time, price_per_hour, total_cost,
                    rental_status, payment_method, payment_verified_at, paid_at,
                    deposit_type, deposit_value)
VALUES ('DEMO0002',
        (SELECT customer_id FROM customer WHERE phone = '082345678901'),
        (SELECT device_id FROM device WHERE serial_number = 'SN-PS3-001'),
        (SELECT staff_id FROM staff WHERE username = 'admin'),
        'Walk-in',
        now() - INTERVAL '8 hours', now() - INTERVAL '8 hours', 5, now() - INTERVAL '3 hours',
        8000, 40000,
        'Overdue', 'Cash', now() - INTERVAL '8 hours', now() - INTERVAL '8 hours',
        'Kartu Pelajar', 'Kartu Pelajar a.n. Sinta Dewi');

-- DEMO0003: Rafi, PS4-02, durasi bebas 2 jam, sudah selesai (Returned)
INSERT INTO rental (booking_code, customer_id, device_id, staff_id, booking_channel,
                    created_at, start_time, duration_hours, end_time, price_per_hour, total_cost,
                    rental_status, payment_method, payment_proof_url, payment_verified_at, paid_at,
                    deposit_type, deposit_value, deposit_returned_at)
VALUES ('DEMO0003',
        (SELECT customer_id FROM customer WHERE phone = '083456789012'),
        (SELECT device_id FROM device WHERE serial_number = 'SN-PS4-002'),
        (SELECT staff_id FROM staff WHERE username = 'admin'),
        'Online',
        now() - INTERVAL '49 hours', now() - INTERVAL '48 hours', 2, now() - INTERVAL '46 hours',
        10000, 20000,
        'Returned', 'Transfer Bank', 'payment_proof/demo-0003.jpg',
        now() - INTERVAL '48 hours 10 minutes', now() - INTERVAL '48 hours 10 minutes',
        'SIM', 'SIM a.n. Rafi Pratama', now() - INTERVAL '46 hours');

-- DEMO0004: Sinta, PS4-01, 4 jam nanti (Booked, bukti bayar belum diunggah)
INSERT INTO rental (booking_code, customer_id, device_id, booking_channel,
                    created_at, start_time, duration_hours, end_time, price_per_hour, total_cost,
                    rental_status, payment_method)
VALUES ('DEMO0004',
        (SELECT customer_id FROM customer WHERE phone = '082345678901'),
        (SELECT device_id FROM device WHERE serial_number = 'SN-PS4-001'),
        'Online',
        now() - INTERVAL '10 minutes', now() + INTERVAL '5 hours', 4, now() + INTERVAL '9 hours',
        10000, 40000,
        'Booked', 'QRIS');

-- DEMO0005: Rafi, PS3-02, paket 3 jam besok (Booked, bayar cash)
INSERT INTO rental (booking_code, customer_id, device_id, package_id, booking_channel,
                    created_at, start_time, duration_hours, end_time, price_per_hour, total_cost,
                    rental_status, payment_method)
VALUES ('DEMO0005',
        (SELECT customer_id FROM customer WHERE phone = '083456789012'),
        (SELECT device_id FROM device WHERE serial_number = 'SN-PS3-002'),
        (SELECT p.package_id
         FROM rental_package p
                  JOIN device d ON d.device_id = p.device_id
         WHERE d.serial_number = 'SN-PS3-002'
           AND p.duration_hours = 3),
        'WhatsApp',
        now() - INTERVAL '30 minutes', now() + INTERVAL '1 day', 3, now() + INTERVAL '1 day 3 hours',
        NULL, 20000,
        'Booked', 'Cash');

-- Riwayat status (untuk linimasa order tracking)
INSERT INTO rental_status_history (rental_id, old_status, new_status, staff_id, changed_at, note)
SELECT r.rental_id,
       h.old_status,
       h.new_status,
       (SELECT staff_id FROM staff WHERE username = h.staff_username),
       now() - h.ago,
       h.note
FROM (VALUES ('DEMO0001', NULL, 'Booked', NULL, INTERVAL '70 minutes', 'Booking created by customer'),
             ('DEMO0001', 'Booked', 'Rented', 'reza', INTERVAL '55 minutes', 'Payment verified by admin'),
             ('DEMO0002', NULL, 'Booked', 'admin', INTERVAL '8 hours', 'Walk-in booking created by admin'),
             ('DEMO0002', 'Booked', 'Rented', 'admin', INTERVAL '8 hours', 'Paid cash on site'),
             ('DEMO0002', 'Rented', 'Overdue', NULL, INTERVAL '3 hours', 'Passed end time, marked automatically'),
             ('DEMO0003', NULL, 'Booked', NULL, INTERVAL '49 hours', 'Booking created by customer'),
             ('DEMO0003', 'Booked', 'Rented', 'admin', INTERVAL '48 hours 10 minutes', 'Payment verified by admin'),
             ('DEMO0003', 'Rented', 'Returned', 'admin', INTERVAL '46 hours', 'Console returned'),
             ('DEMO0004', NULL, 'Booked', NULL, INTERVAL '10 minutes', 'Booking created by customer'),
             ('DEMO0005', NULL, 'Booked', NULL, INTERVAL '30 minutes',
              'Booking created via WhatsApp')) AS h(code, old_status, new_status, staff_username, ago, note)
         JOIN rental r ON r.booking_code = h.code;

-- Perpanjangan: DEMO0001 ditambah 1 jam (tarif dasar PS4 Rp 10.000/jam)
INSERT INTO rental_extension (rental_id, staff_id, added_hours, extra_cost, payment_method, created_at)
SELECT r.rental_id,
       (SELECT staff_id FROM staff WHERE username = 'reza'),
       1,
       10000,
       'Cash',
       now() - INTERVAL '10 minutes'
FROM rental r
WHERE r.booking_code = 'DEMO0001';

-- Pengecekan kondisi barang untuk rental yang sudah dikembalikan
INSERT INTO rental_item_check (rental_id, item_name, condition_at_pickup, condition_at_return, notes)
SELECT r.rental_id, i.item, 'Good', 'Good', i.note
FROM rental r
         CROSS JOIN (VALUES ('Controller 1', NULL::text),
                            ('Controller 2', NULL::text),
                            ('HDMI Cable', 'Slight scratch on the cable')) AS i(item, note)
WHERE r.booking_code = 'DEMO0003';