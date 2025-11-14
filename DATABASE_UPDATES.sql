-- =====================================================
-- ACTUALIZACIONES DE BASE DE DATOS - VAEBRIDGE DISCORD BOT
-- =====================================================
-- Ejecuta este archivo para actualizar la base de datos
-- Compatible con MySQL 5.7 y 8.0

-- ============= TABLA: leaderboard_config =============
CREATE TABLE IF NOT EXISTS leaderboard_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL UNIQUE,
    normal_channel_id VARCHAR(20),
    high_channel_id VARCHAR(20),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============= TABLA: tier_test_results =============
CREATE TABLE IF NOT EXISTS tier_test_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    minecraft_uuid VARCHAR(36) NOT NULL,
    tier_rank VARCHAR(10) NOT NULL,
    tier_division VARCHAR(20),
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    posted_to_leaderboard TINYINT(1) DEFAULT 0,
    KEY idx_uuid (minecraft_uuid),
    KEY idx_posted (posted_to_leaderboard),
    KEY idx_completed (completed_at)
);

-- ============= ACTUALIZAR player_stats =============
-- Agregar rank_prefix si no existe
SET @dbname = DATABASE();
SET @tablename = 'player_stats';
SET @columnname = 'rank_prefix';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_NAME = @tablename)
      AND (TABLE_SCHEMA = @dbname)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(50) DEFAULT NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Agregar points si no existe
SET @columnname = 'points';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_NAME = @tablename)
      AND (TABLE_SCHEMA = @dbname)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT DEFAULT 0')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SELECT '✅ Base de datos actualizada correctamente!' AS resultado;
