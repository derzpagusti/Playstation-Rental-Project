
-- Data contoh booking pelanggan.
-- address_snapshot menyimpan alamat saat checkout.

INSERT INTO booking (
    booking_code,
    customer_id,
    staff_id,
    booking_channel,
    created_at,
    address_snapshot
)
SELECT
    sample.booking_code,
    customer.user_id,
    staff.user_id,
    sample.booking_channel,
    NOW() - sample.created_ago,
    sample.address_snapshot
FROM (
         VALUES
             (
                 'DEMO0001',
                 '081234567890',
                 'reza',
                 'Online',
                 INTERVAL '25 hours',
                 'Jl. Soekarno Hatta, Malang'
             ),
             (
                 'DEMO0002',
                 '082345678901',
                 'admin',
                 'Walk-in',
                 INTERVAL '31 hours',
                 'Jl. Ijen, Malang'
             ),
             (
                 'DEMO0003',
                 '083456789012',
                 'admin',
                 'Online',
                 INTERVAL '97 hours',
                 'Jl. Veteran, Malang'
             ),
             (
                 'DEMO0004',
                 '082345678901',
                 NULL,
                 'Online',
                 INTERVAL '0 minutes',
                 'Jl. Ijen, Malang'
             ),
             (
                 'DEMO0005',
                 '083456789012',
                 NULL,
                 'WhatsApp',
                 INTERVAL '30 minutes',
                 'Jl. Veteran, Malang'
             )
     ) AS sample (
                  booking_code,
                  phone,
                  staff_username,
                  booking_channel,
                  created_ago,
                  address_snapshot
    )
         JOIN users customer
              ON customer.phone = sample.phone
         LEFT JOIN users staff
                   ON staff.username = sample.staff_username;
