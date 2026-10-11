-- Akun customer bersifat opsional (hybrid):
--   password_hash NULL     = customer tamu (booking tanpa akun)
--   password_hash terisi   = customer yang sudah sign up
-- Nomor HP tetap identitas utama dan wajib unik.
CREATE TABLE customer
(
    customer_id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name             VARCHAR(100) NOT NULL,
    phone                 VARCHAR(20)  NOT NULL UNIQUE,
    email                 VARCHAR(100),
    password_hash         VARCHAR(255),
    identity_doc_type     VARCHAR(20)
        CHECK (identity_doc_type IN ('Kartu Pelajar', 'KTP', 'SIM')),
    identity_doc_url      VARCHAR(255),
    identity_doc_verified BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX uq_customer_email_lower
    ON customer (lower(email)) WHERE email IS NOT NULL;