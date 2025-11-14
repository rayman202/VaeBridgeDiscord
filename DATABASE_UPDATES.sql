-- Tabla para configuración de canales de leaderboard
CREATE TABLE IF NOT EXISTS leaderboard_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL UNIQUE,
    normal_channel_id VARCHAR(20),
    high_channel_id VARCHAR(20),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para resultados de tier tests (si no existe)
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

-- Agregar campo posted_to_leaderboard si no existe
ALTER TABLE tier_test_results
ADD COLUMN IF NOT EXISTS posted_to_leaderboard TINYINT(1) DEFAULT 0;

-- Crear índice para búsquedas rápidas si no existe
CREATE INDEX IF NOT EXISTS idx_posted ON tier_test_results(posted_to_leaderboard);
