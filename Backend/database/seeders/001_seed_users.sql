-- Password dev admin: admin12345 (GANTI sebelum dipakai di luar laptop sendiri)
INSERT INTO users (role, full_name, username, password_hash)
VALUES ('owner', 'Reza Mahardika', 'reza', '$2y$12$Fctyqx33xXy4/RRTTRkdheqD22IqSznpEjJTtySlLmZLGBOJG7oZC'),
       ('admin', 'Admin Kasir', 'admin', '$2y$12$Fctyqx33xXy4/RRTTRkdheqD22IqSznpEjJTtySlLmZLGBOJG7oZC');

-- Budi  : sudah punya akun (password dev: customer12345), KTP terverifikasi
-- Sinta : customer tamu, Kartu Pelajar belum diverifikasi
-- Rafi  : customer tamu, SIM terverifikasi
INSERT INTO users (role, full_name, phone, email, password_hash,
                   identity_doc_type, identity_doc_url, identity_doc_verified)
VALUES ('customer', 'Budi Santoso', '081234567890', 'budi@example.com',
        '$2y$12$U8JzZd7e3XiLyBF0mFpcrO0DRQ2I7zGG.ZayNzE1FESk3/7pN620O',
        'KTP', 'identity_docs/demo-budi.jpg', TRUE),
       ('customer', 'Sinta Dewi', '082345678901', NULL, NULL,
        'Kartu Pelajar', 'identity_docs/demo-sinta.jpg', FALSE),
       ('customer', 'Rafi Pratama', '083456789012', 'rafi@example.com', NULL,
        'SIM', 'identity_docs/demo-rafi.jpg', TRUE);