CREATE TABLE rental
(
    rental_id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_code        VARCHAR(8)     NOT NULL UNIQUE
                                                DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
    customer_id         INT            NOT NULL REFERENCES customer (customer_id),
    device_id           INT            NOT NULL REFERENCES device (device_id),
    staff_id            INT REFERENCES staff (staff_id),                     -- NULL = belum diverifikasi
    package_id          INT REFERENCES rental_package (package_id),          -- NULL = durasi bebas
    booking_channel     VARCHAR(20)    NOT NULL DEFAULT 'Online'
        CHECK (booking_channel IN ('Online', 'Walk-in', 'WhatsApp')),
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT now(),
    start_time          TIMESTAMPTZ    NOT NULL,
    duration_hours      INT            NOT NULL CHECK (duration_hours >= 1), -- minimal 1 jam
    end_time            TIMESTAMPTZ    NOT NULL,
    price_per_hour      NUMERIC(10, 2),                                      -- NULL jika pakai paket
    total_cost          NUMERIC(12, 2) NOT NULL,
    rental_status       VARCHAR(20)    NOT NULL DEFAULT 'Booked'
        CHECK (rental_status IN ('Booked', 'Rented', 'Overdue', 'Returned')),
    payment_method      VARCHAR(20)
        CHECK (payment_method IN ('QRIS', 'Transfer Bank', 'Cash')),
    payment_proof_url   VARCHAR(255),
    payment_verified_at TIMESTAMPTZ,
    paid_at             TIMESTAMPTZ,
    deposit_type        VARCHAR(20),
    deposit_value       VARCHAR(100),
    deposit_returned_at TIMESTAMPTZ,

    CONSTRAINT chk_pricing_mode CHECK (
        (package_id IS NULL AND price_per_hour IS NOT NULL) OR
        (package_id IS NOT NULL AND price_per_hour IS NULL)
        ),
    -- Mencegah double booking: satu device tidak boleh punya dua
    -- rental aktif dengan rentang waktu yang bertumpuk.
    CONSTRAINT          rental_no_overlap EXCLUDE USING gist (
        device_id WITH =,
        tstzrange(start_time, end_time, '[)') WITH &&
    ) WHERE (rental_status <> 'Returned')
);

CREATE INDEX idx_rental_customer ON rental(customer_id);
CREATE INDEX idx_rental_device   ON rental(device_id);
CREATE INDEX idx_rental_status   ON rental(rental_status);
CREATE INDEX idx_rental_start    ON rental(start_time);