-- Satu baris = satu device dalam sebuah booking.
-- Double booking dicegah oleh backend (lock_device + slot_is_free
-- di dalam transaksi), bukan oleh constraint database.
CREATE TABLE rental
(
    rental_id      SERIAL PRIMARY KEY,
    booking_id     INT            NOT NULL REFERENCES booking (booking_id) ON DELETE CASCADE,
    device_id      INT            NOT NULL REFERENCES device (device_id),
    package_id     INT REFERENCES rental_package (package_id),          -- NULL = durasi bebas
    start_time     TIMESTAMPTZ    NOT NULL,
    duration_hours INT            NOT NULL CHECK (duration_hours >= 1), -- minimal 1 jam
    end_time       TIMESTAMPTZ    NOT NULL,
    price_per_hour NUMERIC(10, 2),                                      -- NULL jika pakai paket
    total_cost     NUMERIC(12, 2) NOT NULL,
    rental_status  VARCHAR(20)    NOT NULL DEFAULT 'Booked'
        CHECK (rental_status IN ('Booked', 'Rented', 'Overdue', 'Returned')),

    CONSTRAINT uq_booking_device UNIQUE (booking_id, device_id),        -- device sama tidak boleh dobel dalam satu pesanan
    CONSTRAINT chk_end_after_start CHECK (end_time > start_time),
    CONSTRAINT chk_pricing_mode CHECK (
        (package_id IS NULL AND price_per_hour IS NOT NULL) OR
        (package_id IS NOT NULL AND price_per_hour IS NULL)
        )
);

CREATE INDEX idx_rental_booking ON rental (booking_id);
CREATE INDEX idx_rental_device ON rental (device_id);
CREATE INDEX idx_rental_status ON rental (rental_status);
CREATE INDEX idx_rental_start ON rental (start_time);