-- =====================================================
-- ACTUALIZACIONES DE BASE DE DATOS - VAEBRIDGE DISCORD BOT
-- =====================================================
-- Ejecuta este archivo para actualizar la base de datos con las nuevas funciones

-- Tabla para configuración de canales de leaderboard
CREATE TABLE IF NOT EXISTS leaderboard_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL UNIQUE,
    normal_channel_id VARCHAR(20),
    high_channel_id VARCHAR(20),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para resultados de tier tests
CREATE TABLE IF NOT EXISTS tier_test_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    minecraft_uuid VARCHAR(36) NOT NULL,
    tier_rank VARCHAR(10) NOT NULL,
    tier_division VARCHAR(20),
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    posted_to_leaderboard TINYINT(1) DEFAULT 0,
    INDEX idx_uuid (minecraft_uuid),
    INDEX idx_posted (posted_to_leaderboard),
    INDEX idx_completed (completed_at)
);

-- Agregar columna rank_prefix a player_stats si no existe (para LuckPerms)
ALTER TABLE player_stats
ADD COLUMN IF NOT EXISTS rank_prefix VARCHAR(50) DEFAULT NULL;

-- Agregar columna points a player_stats si no existe
ALTER TABLE player_stats
ADD COLUMN IF NOT EXISTS points INT DEFAULT 0;

SELECT 'Base de datos actualizada correctamente!' AS resultado;
