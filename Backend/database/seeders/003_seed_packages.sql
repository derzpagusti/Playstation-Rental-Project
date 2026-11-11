INSERT INTO rental_package (device_id, package_name, duration_hours, package_price, is_active)
SELECT d.device_id,
       p.package_name,
       p.duration_days * 24,
       d.price_per_day * p.duration_days,
       p.is_active
FROM device d
         CROSS JOIN (VALUES ('Paket 2 Hari', 2, TRUE),
                            ('Paket 3 Hari', 3, TRUE),
                            ('Paket 7 Hari', 7, FALSE)) AS p(package_name, duration_days, is_active)
WHERE d.category IN ('PS4', 'PS5');