CREATE TABLE payment (
    payment_id SERIAL PRIMARY KEY,
    booking_id INT NOT NULL UNIQUE REFERENCES booking(booking_id) ON DELETE CASCADE,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('QRIS', 'Cash')),
    payment_status VARCHAR(30) NOT NULL DEFAULT 'Pending' CHECK (payment_status IN (
        'Pending',
        'AwaitingVerification',
        'Paid',
        'Expired',
        'Rejected',
        'Cancelled'
        )),
    payment_expires_at TIMESTAMPTZ,
    payment_proof_url VARCHAR(255),
    payment_verified_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,

    CONSTRAINT chk_payment_consistency
    CHECK ((payment_status = 'Paid') = (payment_verified_at IS NOT NULL))
);