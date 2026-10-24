-- Satu paket nonaktif untuk menguji is_active
INSERT INTO rental_package (device_id, package_name, duration_hours, package_price, is_active)
SELECT d.device_id, p.name, p.hours, p.price, p.active
FROM device d
         JOIN (VALUES ('PS3', 'Paket Hemat 3 Jam', 3, 20000, TRUE),
                      ('PS4', 'Paket Hemat 3 Jam', 3, 25000, TRUE),
                      ('PS3', 'Paket Santai 6 Jam', 6, 36000, TRUE),
                      ('PS4', 'Paket Santai 6 Jam', 6, 45000, TRUE),
                      ('PS4', 'Paket Promo 2 Jam', 2, 15000, FALSE)) AS p(category, name, hours, price, active)
              ON p.category = d.category;