CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `full_name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `is_verified` TINYINT(1) NOT NULL DEFAULT 0,
    `verification_token` VARCHAR(128) DEFAULT NULL,
    `verification_expires_at` DATETIME DEFAULT NULL,
    `reset_code` VARCHAR(6) DEFAULT NULL,
    `reset_code_expires_at` DATETIME DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_email` (`email`),
    KEY `idx_users_verification_token` (`verification_token`),
    KEY `idx_users_reset_code_expires_at` (`reset_code_expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
