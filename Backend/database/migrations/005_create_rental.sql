CREATE TABLE rental
(
    rental_id           SERIAL PRIMARY KEY,
    booking_id          INT            NOT NULL REFERENCES booking (booking_id) ON DELETE CASCADE,
    device_id           INT            NOT NULL REFERENCES device (device_id),
    package_id          INT REFERENCES rental_package (package_id),          -- NULL = durasi bebas
    start_time          TIMESTAMPTZ    NOT NULL,
    duration_hours      INT            NOT NULL CHECK (duration_hours >= 1), -- minimal 1 jam, sudah termasuk perpanjangan
    end_time            TIMESTAMPTZ    NOT NULL,
    price_per_hour      NUMERIC(10, 2),                                      -- NULL jika pakai paket
    total_cost          NUMERIC(12, 2) NOT NULL,                             -- sudah termasuk perpanjangan
    extra_hours         INT            NOT NULL DEFAULT 0 CHECK (extra_hours >= 0),
    extra_cost          NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (extra_cost >= 0),
    rental_status       VARCHAR(20)    NOT NULL DEFAULT 'Booked'
        CHECK (rental_status IN ('Booked', 'Rented', 'Overdue', 'Returned')),
    rented_at           TIMESTAMPTZ,                                         -- waktu diverifikasi admin
    overdue_at          TIMESTAMPTZ,                                         -- waktu ditandai Overdue
    returned_at         TIMESTAMPTZ,                                         -- waktu dikembalikan
    condition_at_pickup VARCHAR(100),
    condition_at_return VARCHAR(100),
    condition_notes     VARCHAR(255),

    CONSTRAINT uq_booking_device UNIQUE (booking_id, device_id),             -- device sama tidak boleh dobel dalam satu pesanan
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