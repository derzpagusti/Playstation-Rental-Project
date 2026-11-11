-- Satu pesanan (transaksi) yang bisa berisi banyak device.
-- customer_id harus user ber-role 'customer' dan staff_id harus
-- ber-role 'admin'/'owner'; pengecekannya dilakukan di backend.

CREATE TABLE booking
(
    booking_id          SERIAL PRIMARY KEY,
    booking_code        VARCHAR(8)  NOT NULL UNIQUE DEFAULT UPPER(SUBSTR(MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text), 1, 8)),
    customer_id         INT         NOT NULL REFERENCES users (user_id),
    staff_id            INT REFERENCES users (user_id),
    booking_channel     VARCHAR(20) NOT NULL DEFAULT 'Online' CHECK (booking_channel IN ('Online', 'Walk-in', 'WhatsApp')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payment_method      VARCHAR(20) NOT NULL CHECK (payment_method IN ('QRIS', 'Transfer Bank', 'Cash')),
    payment_status      VARCHAR(30) NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'AwaitingVerification', 'Paid', 'Expired', 'Rejected', 'Cancelled')),
    notes               VARCHAR(255),
    cancel_reason       VARCHAR(255),
    cancelled_at        TIMESTAMPTZ,

    payment_expires_at  TIMESTAMPTZ,
    payment_proof_url   VARCHAR(255),
    payment_verified_at TIMESTAMPTZ,
    paid_at             TIMESTAMPTZ,
    deposit_type        VARCHAR(20),
    deposit_value       VARCHAR(100),
    deposit_returned_at TIMESTAMPTZ,

    CONSTRAINT chk_payment_consistency CHECK ((payment_status = 'Paid') = (payment_verified_at IS NOT NULL))

);

CREATE INDEX idx_booking_customer ON booking (customer_id);

CREATE INDEX idx_booking_payment_expiry ON booking (payment_status, payment_expires_at);