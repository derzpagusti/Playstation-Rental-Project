-- Admin/owner tetap login
CREATE TABLE staff
(
    staff_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name     VARCHAR(100) NOT NULL,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'admin'
        CHECK (role IN ('admin', 'owner'))
);