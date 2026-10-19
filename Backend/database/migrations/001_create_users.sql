CREATE TABLE users
(
    user_id               SERIAL PRIMARY KEY,
    role                  VARCHAR(20)  NOT NULL DEFAULT 'customer'
        CHECK (role IN ('customer', 'admin', 'owner')),
    full_name             VARCHAR(100) NOT NULL,
    phone                 VARCHAR(20) UNIQUE,
    email                 VARCHAR(100),
    username              VARCHAR(50) UNIQUE,
    password_hash         VARCHAR(255),
    identity_doc_type     VARCHAR(20)
        CHECK (identity_doc_type IN ('Kartu Pelajar', 'KTP', 'SIM')),
    identity_doc_url      VARCHAR(255),
    identity_doc_verified BOOLEAN      NOT NULL DEFAULT FALSE,

    CONSTRAINT chk_user_role_fields CHECK (
        (role = 'customer' AND phone IS NOT NULL) OR
        (role IN ('admin', 'owner') AND username IS NOT NULL AND password_hash IS NOT NULL)
        )
);

-- Email tidak boleh ganda tanpa membedakan huruf besar/kecil.
-- Banyak user tanpa email (NULL) tetap diperbolehkan.
CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));