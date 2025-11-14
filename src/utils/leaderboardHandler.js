const pool = require('./db.js');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

class LeaderboardHandler {
    constructor(client) {
        this.client = client;
    }

    /**
     * Inicia el sistema de actualización de leaderboards.
     */
    start() {
        // Revisar por nuevos resultados de tier tests cada 20 segundos
        setInterval(() => {
            this.processNewTierTestResults().catch(console.error);
        }, 20000);
        console.log('✅ Leaderboard handler system started');
    }

    /**
     * Procesa nuevos resultados de tier tests y los publica en los canales configurados.
     */
    async processNewTierTestResults() {
        let connection;
        try {
            connection = await pool.getConnection();

            // Buscar resultados no publicados
            const [results] = await connection.query(`
                SELECT ttr.*, ps.name as player_name, ps.uuid
                FROM tier_test_results ttr
                JOIN player_stats ps ON ttr.minecraft_uuid = ps.uuid
                WHERE ttr.posted_to_leaderboard = 0
                ORDER BY ttr.completed_at DESC
                LIMIT 10
            `).catch(err => {
                // Si la tabla no existe, simplemente retornar array vacío
                if (err.code === 'ER_NO_SUCH_TABLE') {
                    return [[]];
                }
                throw err;
            });

            if (results.length === 0) {
                return;
            }

            console.log(`[LEADERBOARD] Found ${results.length} new tier test results to post.`);

            for (const result of results) {
                try {
                    await this.postTierTestResult(result);

                    // Marcar como publicado
                    await connection.query(
                        'UPDATE tier_test_results SET posted_to_leaderboard = 1 WHERE id = ?',
                        [result.id]
                    );

                    console.log(`[LEADERBOARD] Posted tier test result ${result.id} for player ${result.player_name}`);
                } catch (error) {
                    console.error(`[LEADERBOARD] Error posting result ${result.id}:`, error);
                }
            }
        } catch (error) {
            if (error.code !== 'ETIMEDOUT' && error.code !== 'ECONNREFUSED') {
                console.error('[LEADERBOARD] Error fetching tier test results:', error);
            }
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    /**
     * Publica un resultado de tier test en los canales configurados.
     */
    async postTierTestResult(result) {
        const [configs] = await pool.query('SELECT * FROM leaderboard_config');

        if (configs.length === 0) {
            console.log('[LEADERBOARD] No leaderboard configurations found. Use /setup-leaderboard first.');
            return;
        }

        const isHighResult = this.isHighTierResult(result.tier_rank);

        for (const config of configs) {
            try {
                const guild = await this.client.guilds.fetch(config.guild_id).catch(() => null);
                if (!guild) continue;

                // Publicar en canal normal (todos los resultados)
                if (config.normal_channel_id) {
                    const normalChannel = await guild.channels.fetch(config.normal_channel_id).catch(() => null);
                    if (normalChannel) {
                        const embed = await this.createTierTestEmbed(result, false);
                        await normalChannel.send({ embeds: [embed] });
                    }
                }

                // Publicar en canal alto solo si es resultado alto (> LT1)
                if (isHighResult && config.high_channel_id) {
                    const highChannel = await guild.channels.fetch(config.high_channel_id).catch(() => null);
                    if (highChannel) {
                        const embed = await this.createTierTestEmbed(result, true);
                        await highChannel.send({ embeds: [embed] });
                    }
                }
            } catch (error) {
                console.error(`[LEADERBOARD] Error posting to guild ${config.guild_id}:`, error);
            }
        }
    }

    /**
     * Determina si un tier rank es considerado "alto" (mayor a LT1).
     */
    isHighTierResult(tierRank) {
        if (!tierRank) return false;

        const tier = tierRank.toUpperCase();

        // GT, HT, MT son siempre altos
        if (tier.includes('GT') || tier.includes('HT') || tier.includes('MT')) {
            return true;
        }

        // LT solo si es LT2, LT3, etc. (no LT1)
        if (tier.includes('LT')) {
            const match = tier.match(/LT(\d+)/);
            if (match) {
                const num = parseInt(match[1]);
                return num > 1; // LT2 o superior
            }
        }

        return false;
    }

    /**
     * Crea un embed bonito para mostrar un resultado de tier test.
     */
    async createTierTestEmbed(result, isHighChannel) {
        const tierEmoji = this.getTierEmoji(result.tier_rank);
        const tierColor = this.getTierColor(result.tier_rank);

        // Obtener datos del jugador
        const [playerData] = await pool.query(
            'SELECT * FROM player_stats WHERE uuid = ?',
            [result.uuid]
        );

        const player = playerData[0] || {};

        const embed = new EmbedBuilder()
            .setColor(tierColor)
            .setAuthor({
                name: result.player_name,
                iconURL: `https://crafatar.com/avatars/${result.uuid}?overlay&size=64`
            })
            .setTitle(`${tierEmoji} TIER TEST COMPLETADO`)
            .setThumbnail(`https://crafatar.com/renders/head/${result.uuid}?overlay&scale=10`)
            .setDescription(`━━━━━━━━━━━━━━━━━━━━━━`)
            .addFields(
                {
                    name: '🎯 Tier Alcanzado',
                    value: `\`\`\`${result.tier_rank || 'N/A'}\`\`\``,
                    inline: true
                },
                {
                    name: '🏆 División',
                    value: `\`\`\`${this.getTierDivision(result.tier_rank)}\`\`\``,
                    inline: true
                },
                {
                    name: '📅 Fecha',
                    value: `<t:${Math.floor(new Date(result.completed_at).getTime() / 1000)}:R>`,
                    inline: true
                },
                {
                    name: '\u200B',
                    value: '━━━━━━━━━━━━━━━━━━━━━━',
                    inline: false
                },
                {
                    name: '📊 Rango de Victorias',
                    value: `**${player.victory_rank || 'Sin Rango'}**`,
                    inline: true
                },
                {
                    name: '🧠 ELO',
                    value: `**${player.elo || '1000'}**`,
                    inline: true
                },
                {
                    name: '✅ Victorias',
                    value: `**${player.wins || 0}**`,
                    inline: true
                }
            )
            .setFooter({
                text: isHighChannel ? '🏆 Resultado Alto • Tier Test' : '📊 Tier Test',
                iconURL: 'https://crafatar.com/avatars/' + result.uuid + '?overlay&size=32'
            })
            .setTimestamp(new Date(result.completed_at));

        return embed;
    }

    /**
     * Obtiene el emoji correspondiente a un tier rank.
     */
    getTierEmoji(tierRank) {
        if (!tierRank) return '❓';

        const tier = tierRank.toUpperCase();
        if (tier.includes('GT')) return '👑';
        if (tier.includes('HT')) return '💎';
        if (tier.includes('MT')) return '⭐';
        if (tier.includes('LT')) return '🔥';
        return '🎯';
    }

    /**
     * Obtiene el color correspondiente a un tier rank.
     */
    getTierColor(tierRank) {
        if (!tierRank) return 0x7289DA;

        const tier = tierRank.toUpperCase();
        if (tier.includes('GT')) return 0xFF0000; // Rojo
        if (tier.includes('HT')) return 0xFF6B35; // Naranja rojizo
        if (tier.includes('MT')) return 0xFFD700; // Dorado

        if (tier.includes('LT')) {
            const num = parseInt(tier.match(/\d+/)?.[0] || '0');
            if (num <= 3) return 0x00FF88; // Verde brillante
            if (num <= 6) return 0x00D9FF; // Cian
            return 0x9D4EDD; // Púrpura
        }

        return 0x7289DA;
    }

    /**
     * Obtiene la división de un tier rank.
     */
    getTierDivision(tierRank) {
        if (!tierRank) return 'Sin División';

        const tier = tierRank.toUpperCase();

        if (tier.includes('GT')) return 'God Tier';
        if (tier.includes('HT')) return 'High Tier';
        if (tier.includes('MT')) return 'Mid Tier';
        if (tier.includes('LT')) return 'Low Tier';

        return 'Sin División';
    }
}

module.exports = LeaderboardHandler;
