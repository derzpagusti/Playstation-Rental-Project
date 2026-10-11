-- Tarif per jam bertingkat, satu set per kategori
INSERT INTO pricing_tier (device_id, min_hours, price_per_hour)
SELECT d.device_id, t.min_hours, t.price
FROM device d
         JOIN (VALUES ('PS3', 1, 8000),
                      ('PS3', 12, 6000),
                      ('PS3', 24, 5000),
                      ('PS4', 1, 10000),
                      ('PS4', 12, 8000),
                      ('PS4', 24, 6500)) AS t(category, min_hours, price) ON t.category = d.category;

-- Paket harga tetap (satu paket nonaktif untuk menguji is_active)
INSERT INTO rental_package (device_id, package_name, duration_hours, package_price, is_active)
SELECT d.device_id, p.name, p.hours, p.price, p.active
FROM device d
         JOIN (VALUES ('PS3', 'Paket Hemat 3 Jam', 3, 20000, TRUE),
                      ('PS4', 'Paket Hemat 3 Jam', 3, 25000, TRUE),
                      ('PS3', 'Paket Santai 6 Jam', 6, 36000, TRUE),
                      ('PS4', 'Paket Santai 6 Jam', 6, 45000, TRUE),
                      ('PS4', 'Paket Promo 2 Jam', 2, 15000, FALSE)) AS p(category, name, hours, price, active)
              ON p.category = d.category;