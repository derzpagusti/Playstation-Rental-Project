CREATE TABLE rental
(
    rental_id SERIAL PRIMARY KEY,
    booking_id INT NOT NULL REFERENCES booking (booking_id) ON DELETE CASCADE,
    device_id INT NOT NULL REFERENCES device (device_id),
    start_time TIMESTAMPTZ NOT NULL,
    duration_hours INT NOT NULL CHECK (duration_hours >= 24 AND MOD(duration_hours, 24) = 0),
    end_time TIMESTAMPTZ NOT NULL,
    price_per_day NUMERIC(10, 2) NOT NULL CHECK (price_per_day > 0),
    total_cost NUMERIC(12, 2) NOT NULL CHECK (total_cost >= 0),
    rental_status VARCHAR(20) NOT NULL DEFAULT 'Booked'
        CHECK (rental_status IN (
                              'Booked',
                              'Rented',
                              'Overdue',
                              'Returned',
                              'Cancelled')
        ),
    rented_at TIMESTAMPTZ,
    overdue_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    condition_at_pickup VARCHAR(100),
    condition_at_return VARCHAR(100),
    condition_notes VARCHAR(255),

    CONSTRAINT uq_booking_device UNIQUE (booking_id, device_id),
    CONSTRAINT chk_end_after_start CHECK (end_time > start_time),
    CONSTRAINT chk_duration_matches_end CHECK (end_time = start_time + duration_hours * INTERVAL '1 hour')
);

CREATE INDEX idx_rental_booking ON rental (booking_id);
CREATE INDEX idx_rental_device ON rental (device_id);
CREATE INDEX idx_rental_status ON rental (rental_status);
CREATE INDEX idx_rental_start ON rental (start_time);
