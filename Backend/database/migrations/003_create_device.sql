CREATE TABLE device
(
    device_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_name   VARCHAR(50) NOT NULL,
    category      VARCHAR(20) NOT NULL CHECK (category IN ('PS3', 'PS4')),
    model         VARCHAR(50),
    serial_number VARCHAR(50) NOT NULL UNIQUE,
    booth_code    VARCHAR(20),
    status        VARCHAR(20) NOT NULL DEFAULT 'Available'
        CHECK (status IN ('Available', 'Maintenance'))
);