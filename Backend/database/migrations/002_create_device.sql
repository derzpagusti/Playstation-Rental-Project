-- Harga sewa harian per device; 1 hari = 24 jam.
CREATE TABLE device
(
    device_id      SERIAL PRIMARY KEY,
    device_name    VARCHAR(50)    NOT NULL,
    category       VARCHAR(20)    NOT NULL CHECK (category IN ('PS4', 'PS5')),
    model          VARCHAR(50),
    serial_number  VARCHAR(50)    NOT NULL UNIQUE,
    booth_code     VARCHAR(20),
    price_per_day NUMERIC(10, 2) NOT NULL CHECK (price_per_day > 0),
    status         VARCHAR(20)    NOT NULL DEFAULT 'Available'
        CHECK (status IN ('Available', 'Maintenance'))
);