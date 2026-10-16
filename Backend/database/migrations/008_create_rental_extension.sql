CREATE TABLE rental_extension
(
    extension_id   SERIAL PRIMARY KEY,
    rental_id      INT            NOT NULL REFERENCES rental (rental_id) ON DELETE CASCADE,
    staff_id       INT            NOT NULL REFERENCES staff (staff_id),
    added_hours    INT            NOT NULL CHECK (added_hours >= 1),
    extra_cost     NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(20)
        CHECK (payment_method IN ('QRIS', 'Transfer Bank', 'Cash')),
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);