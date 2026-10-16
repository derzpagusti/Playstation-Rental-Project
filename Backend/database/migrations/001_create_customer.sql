-- password_hash NULL = customer tamu, terisi = sudah sign up
CREATE TABLE customer
(
    customer_id           SERIAL PRIMARY KEY,
    full_name             VARCHAR(100) NOT NULL,
    phone                 VARCHAR(20)  NOT NULL UNIQUE,
    email                 VARCHAR(100),
    password_hash         VARCHAR(255),
    identity_doc_type     VARCHAR(20)
        CHECK (identity_doc_type IN ('Kartu Pelajar', 'KTP', 'SIM')),
    identity_doc_url      VARCHAR(255),
    identity_doc_verified BOOLEAN      NOT NULL DEFAULT FALSE
);

-- Email tidak boleh ganda tanpa membedakan huruf besar/kecil.
-- Banyak customer tanpa email (NULL) tetap diperbolehkan.
CREATE UNIQUE INDEX uq_customer_email_lower ON customer (lower(email));