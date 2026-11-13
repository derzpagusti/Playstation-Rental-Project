CREATE TABLE booking
(
    booking_id          SERIAL PRIMARY KEY,
    booking_code        VARCHAR(8)  NOT NULL UNIQUE DEFAULT UPPER(SUBSTR(MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text), 1, 8)),
    customer_id         INT         NOT NULL REFERENCES users (user_id),
    staff_id            INT REFERENCES users (user_id),
    booking_channel     VARCHAR(20) NOT NULL DEFAULT 'Online' CHECK (booking_channel IN ('Online', 'Walk-in', 'WhatsApp')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes               VARCHAR(255),
    cancel_reason       VARCHAR(255),
    cancelled_at        TIMESTAMPTZ,
    address_snapshot VARCHAR(255)
);

CREATE INDEX idx_booking_customer ON booking (customer_id);

