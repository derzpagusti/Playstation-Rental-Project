-- Satu pesanan (transaksi) yang bisa berisi banyak device.
-- Menyimpan data yang berlaku untuk seluruh pesanan: kode, customer, pembayaran.
CREATE TABLE booking
(
    booking_id          SERIAL PRIMARY KEY,
    booking_code        VARCHAR(8)  NOT NULL UNIQUE
                                             DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
    customer_id         INT         NOT NULL REFERENCES customer (customer_id),
    staff_id            INT REFERENCES staff (staff_id), -- NULL = belum diverifikasi
    booking_channel     VARCHAR(20) NOT NULL DEFAULT 'Online'
        CHECK (booking_channel IN ('Online', 'Walk-in', 'WhatsApp')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    payment_method      VARCHAR(20)
        CHECK (payment_method IN ('QRIS', 'Transfer Bank', 'Cash')),
    payment_proof_url   VARCHAR(255),
    payment_verified_at TIMESTAMPTZ,
    paid_at             TIMESTAMPTZ,
    deposit_type        VARCHAR(20),
    deposit_value       VARCHAR(100),
    deposit_returned_at TIMESTAMPTZ
);

CREATE INDEX idx_booking_customer ON booking (customer_id);