-- Header booking.
INSERT INTO booking (
    booking_code,
    customer_id,
    staff_id,
    booking_channel,
    created_at,
    payment_method,
    payment_status,
    payment_expires_at,
    payment_proof_url,
    payment_verified_at,
    paid_at
)
SELECT
    sample.booking_code,
    customer.user_id,
    staff.user_id,
    sample.booking_channel,
    NOW() - sample.created_ago,
    sample.payment_method,
    sample.payment_status,
    CASE
        WHEN sample.payment_status = 'Pending'
            AND sample.payment_method <> 'Cash'
            THEN NOW() + INTERVAL '5 minutes'
    ELSE NULL
END,
    sample.proof_path,
    CASE
        WHEN sample.payment_status = 'Paid'
        THEN NOW() - sample.created_ago + INTERVAL '10 minutes'
        ELSE NULL
END,
    CASE
        WHEN sample.payment_status = 'Paid'
        THEN NOW() - sample.created_ago + INTERVAL '10 minutes'
        ELSE NULL
END
FROM (
    VALUES
        (
            'DEMO0001',
            '081234567890',
            'reza',
            'Online',
            INTERVAL '25 hours',
            'QRIS',
            'Paid',
            'payment_proof/demo-0001.jpg'
        ),
        (
            'DEMO0002',
            '082345678901',
            'admin',
            'Walk-in',
            INTERVAL '31 hours',
            'Cash',
            'Paid',
            NULL
        ),
        (
            'DEMO0003',
            '083456789012',
            'admin',
            'Online',
            INTERVAL '97 hours',
            'Transfer Bank',
            'Paid',
            'payment_proof/demo-0003.jpg'
        ),
        (
            'DEMO0004',
            '082345678901',
            NULL,
            'Online',
            INTERVAL '0 minutes',
            'QRIS',
            'Pending',
            NULL
        ),
        (
            'DEMO0005',
            '083456789012',
            NULL,
            'WhatsApp',
            INTERVAL '30 minutes',
            'Cash',
            'Pending',
            NULL
        )
) AS sample (
    booking_code,
    phone,
    staff_username,
    booking_channel,
    created_ago,
    payment_method,
    payment_status,
    proof_path
)
JOIN users customer
    ON customer.phone = sample.phone
LEFT JOIN users staff
    ON staff.username = sample.staff_username;

-- Detail rental.
-- Durasi tetap disimpan dalam jam, dengan 1 hari = 24 jam.
INSERT INTO rental (
    booking_id,
    device_id,
    package_id,
    start_time,
    duration_hours,
    end_time,
    price_per_day,
    total_cost,
    rental_status,
    rented_at,
    overdue_at,
    returned_at,
    condition_at_pickup,
    condition_at_return,
    condition_notes
)
SELECT
    b.booking_id,
    d.device_id,
    p.package_id,
    NOW() + sample.start_offset,
    sample.duration_days * 24,
    NOW() + sample.start_offset
        + sample.duration_days * INTERVAL '24 hours',
    CASE
    WHEN sample.package_name IS NULL
    THEN d.price_per_day
    ELSE NULL
END,
    COALESCE(
        p.package_price,
        sample.duration_days * d.price_per_day
    ),
    sample.rental_status,
    CASE
        WHEN sample.rental_status IN ('Rented', 'Overdue', 'Returned')
        THEN NOW() + sample.start_offset
        ELSE NULL
END,
    CASE
        WHEN sample.rental_status = 'Overdue'
        THEN NOW() + sample.start_offset
            + sample.duration_days * INTERVAL '24 hours'
        ELSE NULL
END,
    CASE
        WHEN sample.rental_status = 'Returned'
        THEN NOW() + sample.start_offset
            + sample.duration_days * INTERVAL '24 hours'
        ELSE NULL
END,
    CASE
        WHEN sample.rental_status IN ('Rented', 'Overdue', 'Returned')
        THEN 'Good'
        ELSE NULL
END,
    CASE
        WHEN sample.rental_status = 'Returned'
        THEN 'Good'
        ELSE NULL
END,
    CASE
        WHEN sample.rental_status = 'Returned'
        THEN 'Unit dikembalikan lengkap dan dalam kondisi baik'
        ELSE NULL
END
FROM (
    VALUES
        (
            'DEMO0001',
            'SN-PS4-001',
            NULL,
            INTERVAL '-24 hours',
            2,
            'Rented'
        ),
        (
            'DEMO0001',
            'SN-PS5-001',
            NULL,
            INTERVAL '-2 hours',
            1,
            'Rented'
        ),
        (
            'DEMO0002',
            'SN-PS4-002',
            NULL,
            INTERVAL '-30 hours',
            1,
            'Overdue'
        ),
        (
            'DEMO0003',
            'SN-PS5-002',
            NULL,
            INTERVAL '-96 hours',
            2,
            'Returned'
        ),
        (
            'DEMO0004',
            'SN-PS4-001',
            NULL,
            INTERVAL '72 hours',
            1,
            'Booked'
        ),
        (
            'DEMO0005',
            'SN-PS5-001',
            'Paket 2 Hari',
            INTERVAL '48 hours',
            2,
            'Booked'
        )
) AS sample (
    booking_code,
    serial_number,
    package_name,
    start_offset,
    duration_days,
    rental_status
)
JOIN booking b
    ON b.booking_code = sample.booking_code
JOIN device d
    ON d.serial_number = sample.serial_number
LEFT JOIN rental_package p
    ON p.device_id = d.device_id
   AND p.package_name = sample.package_name
   AND p.is_active = TRUE;