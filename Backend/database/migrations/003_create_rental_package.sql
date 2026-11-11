-- Paket harga tetap buatan admin dengan durasi kelipatan 24 jam.
CREATE TABLE rental_package
(
    package_id     SERIAL PRIMARY KEY,
    device_id      INT            NOT NULL REFERENCES device (device_id) ON DELETE CASCADE,
    package_name   VARCHAR(50)    NOT NULL,
    duration_hours INT            NOT NULL CHECK (duration_hours >= 24 AND MOD(duration_hours, 24) = 0),
    package_price  NUMERIC(10, 2) NOT NULL CHECK (package_price > 0),
    is_active      BOOLEAN        NOT NULL DEFAULT TRUE,
    UNIQUE (device_id, package_name)
);