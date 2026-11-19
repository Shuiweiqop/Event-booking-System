-- =====================================================================
--  Mini Event Booking System — MySQL schema (MySQL 8 / MariaDB 10.4+)
--
--  The canonical source is the Laravel migrations in backend/database/migrations.
--  This file is the same structure as plain SQL, for reviewers or for setting up
--  the database without artisan. If you use `php artisan migrate --seed`, you do
--  NOT need to run this file.
-- =====================================================================

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS `event_booking`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `event_booking`;

-- ---------------------------------------------------------------------
-- users: admin accounts (no public user accounts — attendees are identified by email)
-- ---------------------------------------------------------------------
CREATE TABLE `users` (
  `id`                bigint unsigned NOT NULL AUTO_INCREMENT,
  `name`              varchar(255) NOT NULL,
  `email`             varchar(255) NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password`          varchar(255) NOT NULL,             -- bcrypt hash
  `is_admin`          tinyint(1) NOT NULL DEFAULT 0,
  `remember_token`    varchar(100) DEFAULT NULL,
  `created_at`        timestamp NULL DEFAULT NULL,
  `updated_at`        timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- personal_access_tokens: Laravel Sanctum API tokens (admin auth)
-- Only the SHA-256 hash of each token is stored.
-- ---------------------------------------------------------------------
CREATE TABLE `personal_access_tokens` (
  `id`             bigint unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id`   bigint unsigned NOT NULL,
  `name`           text NOT NULL,
  `token`          varchar(64) NOT NULL,
  `abilities`      text DEFAULT NULL,
  `last_used_at`   timestamp NULL DEFAULT NULL,
  `expires_at`     timestamp NULL DEFAULT NULL,
  `created_at`     timestamp NULL DEFAULT NULL,
  `updated_at`     timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`, `tokenable_id`),
  KEY `personal_access_tokens_expires_at_index` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- events
-- Available slots are NOT stored; they are computed as
--   max_attendees - COUNT(confirmed registrations)
-- so cancelling a booking automatically frees a seat (no counter to drift).
-- ---------------------------------------------------------------------
CREATE TABLE `events` (
  `id`            bigint unsigned NOT NULL AUTO_INCREMENT,
  `title`         varchar(150) NOT NULL,
  `description`   text DEFAULT NULL,
  `venue`         varchar(150) DEFAULT NULL,
  `event_date`    date NOT NULL,
  `start_time`    time DEFAULT NULL,
  `max_attendees` int unsigned NOT NULL,
  `created_at`    timestamp NULL DEFAULT NULL,
  `updated_at`    timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `events_event_date_index` (`event_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- registrations
--   event_date        : copy of events.event_date (denormalised on purpose)
--   active_event_date : = event_date while confirmed, NULL once cancelled
--
--   UNIQUE (email, active_event_date) is the database-level guarantee of
--   "one confirmed booking per person per date". Because MySQL allows multiple
--   NULLs in a UNIQUE index, cancelled rows never block a new booking, and the
--   full booking history is kept.
-- ---------------------------------------------------------------------
CREATE TABLE `registrations` (
  `id`                bigint unsigned NOT NULL AUTO_INCREMENT,
  `event_id`          bigint unsigned NOT NULL,
  `name`              varchar(100) NOT NULL,
  `email`             varchar(150) NOT NULL,             -- lower-cased + trimmed
  `event_date`        date NOT NULL,
  `status`            enum('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
  `active_event_date` date DEFAULT NULL,
  `cancel_token_hash` char(64) NOT NULL,                 -- sha256 of the cancel code
  `cancelled_at`      timestamp NULL DEFAULT NULL,
  `created_at`        timestamp NULL DEFAULT NULL,
  `updated_at`        timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `registrations_email_date_unique` (`email`, `active_event_date`),
  KEY `registrations_event_id_status_index` (`event_id`, `status`),
  CONSTRAINT `registrations_event_id_foreign`
    FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- registration_verifications: pending bookings waiting for the emailed code.
-- A row in `registrations` is created only after the correct code is entered.
-- ---------------------------------------------------------------------
CREATE TABLE `registration_verifications` (
  `id`              char(36) NOT NULL,                   -- UUID, unguessable
  `event_id`        bigint unsigned NOT NULL,
  `name`            varchar(100) NOT NULL,
  `email`           varchar(150) NOT NULL,
  `code_hash`       char(64) NOT NULL,                   -- HMAC-SHA256(code, APP_KEY)
  `attempts`        tinyint unsigned NOT NULL DEFAULT 0, -- max 5 wrong guesses
  `expires_at`      datetime NOT NULL,                   -- 10 minutes
  `last_sent_at`    datetime NOT NULL,                   -- resend cooldown
  `verified_at`     datetime DEFAULT NULL,
  `registration_id` bigint unsigned DEFAULT NULL,
  `created_at`      timestamp NULL DEFAULT NULL,
  `updated_at`      timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `registration_verifications_email_created_at_index` (`email`, `created_at`),
  CONSTRAINT `registration_verifications_event_id_foreign`
    FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `registration_verifications_registration_id_foreign`
    FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Sample data
-- Admin login: admin@example.com / Admin@123
-- ---------------------------------------------------------------------
INSERT INTO `users` (`name`, `email`, `password`, `is_admin`, `created_at`, `updated_at`) VALUES
('Admin', 'admin@example.com', '$2y$12$eOzfs5IaUhHM0YydWlei9u0unVBdLaVvu9b/OVhEGYukDsDU3RRda', 1, NOW(), NOW());

INSERT INTO `events` (`title`, `description`, `venue`, `event_date`, `start_time`, `max_attendees`, `created_at`, `updated_at`) VALUES
('React Hooks Deep Dive',      'Hands-on workshop on useState, useEffect, custom hooks and performance.',          'Hall A, KL Tech Hub',   CURDATE() + INTERVAL 3 DAY,  '09:30', 30,  NOW(), NOW()),
('Laravel API Best Practices', 'Same day as the React workshop — try registering for both to see the same-date rule.', 'Hall B, KL Tech Hub',   CURDATE() + INTERVAL 3 DAY,  '14:00', 25,  NOW(), NOW()),
('MySQL Performance Tuning',   'Only 2 seats — good for testing the capacity limit.',                                 'Room 3, Cyberjaya',     CURDATE() + INTERVAL 5 DAY,  '10:00', 2,   NOW(), NOW()),
('UI/UX Design Sprint',        'A one-evening design sprint for developers.',                                          'Online (Zoom)',         CURDATE() + INTERVAL 7 DAY,  '20:00', 100, NOW(), NOW()),
('Cloud Deployment 101',       'From localhost to production: Docker, CI/CD and monitoring.',                          'Penang Digital Centre', CURDATE() + INTERVAL 10 DAY, '09:00', 40,  NOW(), NOW()),
('Startup Networking Night',   'Single seat — fills up after one booking.',                                            'Bangsar South',         CURDATE() + INTERVAL 14 DAY, '19:00', 1,   NOW(), NOW());
