const pool = require('./db.js');

/**
 * Sincroniza los roles de Discord con los rangos de victorias de los jugadores
 * Este sistema revisa periódicamente las notificaciones pendientes y asigna roles
 */
class RoleSync {
    constructor(client) {
        this.client = client;
        this.victoryRankRoles = {
            'Bridge Novato': null,       // No role for Novato
            'Bridge Aprendiz': null,      // Configure these role IDs in Discord
            'Bridge Competidor': null,
            'Bridge Avanzado': null,
            'Bridge Experto': null,
            'Bridge Maestro': null,
            'Bridge Deidad': null
        };
    }

    /**
     * Inicia el sistema de sincronización periódica
     */
    start() {
        // Check for pending notifications every 30 seconds
        setInterval(async () => {
            try {
                await this.processPendingNotifications();
            } catch (error) {
                console.error('Error processing pending notifications:', error);
            }
        }, 30000);

        console.log('✅ Role sync system started');
    }

    /**
     * Procesa las notificaciones pendientes de subidas de rango
     */
    async processPendingNotifications() {
        let connection;
        try {
            // Get a connection from the pool with retry
            connection = await this.getConnectionWithRetry(3);

            const [notifications] = await connection.query(
                `SELECT * FROM pending_notifications
                 WHERE processed = 0 AND notification_type = 'rank_up'
                 LIMIT 10`
            );

            for (const notification of notifications) {
                try {
                    await this.handleRankUpNotification(notification, connection);

                    // Mark as processed
                    await connection.query(
                        'UPDATE pending_notifications SET processed = 1, processed_at = NOW() WHERE id = ?',
                        [notification.id]
                    );
                } catch (error) {
                    console.error(`Error processing notification ${notification.id}:`, error.message);
                }
            }

        } catch (error) {
            // Only log error if it's not a timeout during quiet periods
            if (error.code !== 'ETIMEDOUT' && error.code !== 'ECONNREFUSED') {
                console.error('Error fetching pending notifications:', error.message);
            }
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    /**
     * Gets a database connection with retry logic
     */
    async getConnectionWithRetry(maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await pool.getConnection();
            } catch (error) {
                if (attempt === maxRetries) {
                    throw error;
                }
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    /**
     * Maneja una notificación de subida de rango
     */
    async handleRankUpNotification(notification, connection) {
        const data = JSON.parse(notification.data);
        const uuid = notification.minecraft_uuid;

        // Get Discord link
        const [link] = await connection.query(
            'SELECT discord_id FROM discord_links WHERE minecraft_uuid = ?',
            [uuid]
        );

        if (link.length === 0) {
            console.log(`No Discord link found for UUID: ${uuid}`);
            return;
        }

        const discordId = link[0].discord_id;

        // Get all guilds the bot is in
        for (const [guildId, guild] of this.client.guilds.cache) {
            try {
                const member = await guild.members.fetch(discordId).catch(() => null);
                if (!member) continue;

                // Assign role based on new rank
                await this.assignVictoryRankRole(member, data.new_rank_name);

                // Send congratulations message to announcements channel
                await this.sendRankUpAnnouncement(guild, member, data);

            } catch (error) {
                console.error(`Error processing rank up for guild ${guildId}:`, error);
            }
        }
    }

    /**
     * Asigna el rol de rango por victorias a un miembro
     */
    async assignVictoryRankRole(member, rankName) {
        const guild = member.guild;

        // Remove all victory rank roles
        const allVictoryRanks = [
            'Bridge Novato', 'Bridge Aprendiz', 'Bridge Competidor',
            'Bridge Avanzado', 'Bridge Experto', 'Bridge Maestro', 'Bridge Deidad'
        ];

        for (const roleName of allVictoryRanks) {
            const role = guild.roles.cache.find(r => r.name === roleName);
            if (role && member.roles.cache.has(role.id)) {
                await member.roles.remove(role);
            }
        }

        // Add new role
        const newRole = guild.roles.cache.find(r => r.name === rankName);
        if (newRole) {
            await member.roles.add(newRole);
            console.log(`✅ Assigned role "${rankName}" to ${member.user.tag}`);
        } else {
            console.log(`⚠️ Role "${rankName}" not found in guild ${guild.name}`);
        }
    }

    /**
     * Envía un anuncio de subida de rango al canal de logros
     */
    async sendRankUpAnnouncement(guild, member, data) {
        // Find announcements channel
        const announcementsChannel = guild.channels.cache.find(
            c => c.name === 'logros' || c.name === 'announcements' || c.name === 'anuncios'
        );

        if (!announcementsChannel) return;

        // Only announce for high ranks (Experto, Maestro, Deidad)
        if (data.new_rank_level >= 4) {
            const { EmbedBuilder } = require('discord.js');

            const embed = new EmbedBuilder()
                .setColor(getRankColor(data.new_rank_name))
                .setTitle('🎉 ¡NUEVO RANGO ALCANZADO! 🎉')
                .setDescription(
                    `¡Felicidades ${member}!\n\n` +
                    `Ha alcanzado el rango **${data.new_rank_name}** en el juego.\n` +
                    `¡Un verdadero maestro de The Bridge!`
                )
                .addFields(
                    { name: 'Victorias Totales', value: `${data.total_wins}`, inline: true },
                    { name: 'Recompensa', value: `$${data.reward_money}`, inline: true }
                )
                .setThumbnail(member.user.displayAvatarURL())
                .setFooter({ text: 'Sigue así y alcanza la cima!' })
                .setTimestamp();

            await announcementsChannel.send({ embeds: [embed] });
        }
    }

    /**
     * Sincroniza manualmente todos los roles (comando de administración)
     */
    async syncAllRoles(guild) {
        try {
            const [links] = await pool.query('SELECT * FROM discord_links');

            let synced = 0;
            let errors = 0;

            for (const link of links) {
                try {
                    const member = await guild.members.fetch(link.discord_id).catch(() => null);
                    if (!member) continue;

                    const [playerData] = await pool.query(
                        'SELECT victory_rank FROM players WHERE uuid = ?',
                        [link.minecraft_uuid]
                    );

                    if (playerData.length > 0) {
                        await this.assignVictoryRankRole(member, playerData[0].victory_rank);
                        synced++;
                    }
                } catch (error) {
                    errors++;
                    console.error(`Error syncing roles for ${link.discord_id}:`, error);
                }
            }

            return { synced, errors };

        } catch (error) {
            console.error('Error in syncAllRoles:', error);
            throw error;
        }
    }
}

function getRankColor(rankName) {
    switch (rankName) {
        case 'Bridge Deidad':
            return 0xff0000; // Red
        case 'Bridge Maestro':
            return 0xffd700; // Gold
        case 'Bridge Experto':
            return 0x00ff00; // Green
        case 'Bridge Avanzado':
            return 0x00bfff; // Deep Sky Blue
        case 'Bridge Competidor':
            return 0x9370db; // Medium Purple
        case 'Bridge Aprendiz':
            return 0xc0c0c0; // Silver
        default:
            return 0x808080; // Gray
    }
}

module.exports = RoleSync;
