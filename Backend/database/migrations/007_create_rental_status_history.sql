CREATE TABLE rental_status_history
(
    history_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rental_id  INT         NOT NULL REFERENCES rental (rental_id) ON DELETE CASCADE,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    staff_id   INT REFERENCES staff (staff_id), -- NULL = diubah otomatis oleh sistem
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    note       VARCHAR(255)
);

CREATE INDEX idx_history_rental  ON rental_status_history(rental_id);