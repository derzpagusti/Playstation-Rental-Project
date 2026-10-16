CREATE TABLE rental_item_check
(
    check_id            SERIAL PRIMARY KEY,
    rental_id           INT         NOT NULL REFERENCES rental (rental_id) ON DELETE CASCADE,
    item_name           VARCHAR(50) NOT NULL,
    condition_at_pickup VARCHAR(20),
    condition_at_return VARCHAR(20),
    notes               VARCHAR(255)
);