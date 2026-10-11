-- Tarif per jam bertingkat: tier dengan min_hours terbesar yang
-- masih <= durasi sewa adalah tarif yang berlaku.
CREATE TABLE pricing_tier
(
    pricing_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id      INT            NOT NULL REFERENCES device (device_id) ON DELETE CASCADE,
    min_hours      INT            NOT NULL CHECK (min_hours >= 1),
    price_per_hour NUMERIC(10, 2) NOT NULL CHECK (price_per_hour > 0),
    UNIQUE (device_id, min_hours)
);