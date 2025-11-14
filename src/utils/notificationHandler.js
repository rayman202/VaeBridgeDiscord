const pool = require('./db.js');
const { EmbedBuilder } = require('discord.js');

class NotificationHandler {
    constructor(client) {
        this.client = client;
    }

    /**
     * Inicia el sistema de procesamiento de notificaciones.
     */
    start() {
        // Revisa notificaciones pendientes cada 15 segundos
        setInterval(() => {
            this.processPendingNotifications().catch(console.error);
        }, 15000);
        console.log('✅ Notification handler system started');
    }

    /**
     * Procesa las notificaciones pendientes de la base de datos.
     */
    async processPendingNotifications() {
        let connection;
        try {
            connection = await pool.getConnection();
            const [notifications] = await connection.query(
                'SELECT * FROM pending_notifications WHERE processed = 0 LIMIT 20'
            );

            if (notifications.length === 0) {
                return;
            }

            console.log(`[NOTIFY] Found ${notifications.length} pending notifications.`);

            for (const notification of notifications) {
                try {
                    switch (notification.notification_type) {
                        case 'new_link':
                            await this.handleNewLink(notification);
                            break;
                        case 'rank_up':
                            await this.handleRankUp(notification);
                            break;
                    }

                    // Marcar como procesada
                    await connection.query(
                        'UPDATE pending_notifications SET processed = 1, processed_at = NOW() WHERE id = ?',
                        [notification.id]
                    );
                    console.log(`[NOTIFY] Processed notification ${notification.id} of type ${notification.notification_type}`);
                } catch (error) {
                    console.error(`[NOTIFY] Error processing notification ${notification.id}:`, error);
                    // Opcional: Marcar como fallida para no reintentar indefinidamente
                    await connection.query(
                        'UPDATE pending_notifications SET processed = 2, processed_at = NOW() WHERE id = ?', // 2 para estado de error
                        [notification.id]
                    );
                }
            }
        } catch (error) {
            if (error.code !== 'ETIMEDOUT' && error.code !== 'ECONNREFUSED') {
                console.error('[NOTIFY] Error fetching pending notifications:', error);
            }
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    /**
     * Maneja la notificación de una nueva vinculación de cuenta.
     * @param {object} notification La notificación de la base de datos.
     */
    async handleNewLink(notification) {
        const data = JSON.parse(notification.data);
        const uuid = notification.minecraft_uuid;
        const minecraftUsername = data.minecraft_username;

        if (!minecraftUsername) {
            throw new Error('Notification data is missing minecraft_username');
        }

        const [link] = await pool.query(
            'SELECT discord_id FROM discord_links WHERE minecraft_uuid = ?',
            [uuid]
        );

        if (link.length === 0) {
            console.log(`[NICKNAME] No Discord link found for UUID: ${uuid}. Cannot set nickname.`);
            return;
        }

        const discordId = link[0].discord_id;

        for (const guild of this.client.guilds.cache.values()) {
            try {
                const member = await guild.members.fetch(discordId).catch(() => null);
                if (!member) {
                    continue; // El miembro no está en este servidor
                }

                // Verificar si el bot tiene permisos para cambiar el apodo
                if (!guild.members.me.permissions.has('ManageNicknames')) {
                    console.warn(`[NICKNAME] Missing 'Manage Nicknames' permission in guild: ${guild.name}`);
                    continue;
                }
                
                // Evitar cambiar el apodo del dueño del servidor
                if (member.id === guild.ownerId) {
                    console.log(`[NICKNAME] Cannot change nickname of server owner: ${member.user.tag}`);
                    continue;
                }

                await member.setNickname(minecraftUsername);
                console.log(`[NICKNAME] Set nickname for ${member.user.tag} to "${minecraftUsername}" in guild ${guild.name}.`);

            } catch (error) {
                console.error(`[NICKNAME] Failed to set nickname for user ${discordId} in guild ${guild.id}:`, error);
            }
        }
    }

    /**
     * Maneja una notificación de subida de rango.
     * @param {object} notification La notificación de la base de datos.
     */
    async handleRankUp(notification) {
        const data = JSON.parse(notification.data);
        const uuid = notification.minecraft_uuid;

        const [link] = await pool.query(
            'SELECT discord_id FROM discord_links WHERE minecraft_uuid = ?',
            [uuid]
        );

        if (link.length === 0) {
            console.log(`[RANKUP] No Discord link found for UUID: ${uuid}`);
            return;
        }

        const discordId = link[0].discord_id;

        for (const guild of this.client.guilds.cache.values()) {
            try {
                const member = await guild.members.fetch(discordId).catch(() => null);
                if (!member) continue;

                await this.assignVictoryRankRole(member, data.new_rank_name);
                await this.sendRankUpAnnouncement(guild, member, data);

            } catch (error) {
                console.error(`[RANKUP] Error processing rank up for guild ${guild.id}:`, error);
            }
        }
    }

    /**
     * Asigna el rol de rango por victorias a un miembro.
     * @param {import('discord.js').GuildMember} member El miembro de Discord.
     * @param {string} rankName El nombre del nuevo rango.
     */
    async assignVictoryRankRole(member, rankName) {
        const guild = member.guild;

        const allVictoryRanks = [
            'Bridge Novato', 'Bridge Aprendiz', 'Bridge Competidor',
            'Bridge Avanzado', 'Bridge Experto', 'Bridge Maestro', 'Bridge Deidad'
        ];

        for (const roleName of allVictoryRanks) {
            const role = guild.roles.cache.find(r => r.name === roleName);
            if (role && member.roles.cache.has(role.id)) {
                await member.roles.remove(role).catch(console.error);
            }
        }

        const newRole = guild.roles.cache.find(r => r.name === rankName);
        if (newRole) {
            if (guild.members.me.roles.highest.position <= newRole.position) {
                console.warn(`[ROLES] Cannot assign role "${rankName}" in ${guild.name} because it's higher or equal to my highest role.`);
                return;
            }
            await member.roles.add(newRole);
            console.log(`[ROLES] Assigned role "${rankName}" to ${member.user.tag} in ${guild.name}`);
        } else {
            console.log(`[ROLES] ⚠️ Role "${rankName}" not found in guild ${guild.name}`);
        }
    }

    /**
     * Envía un anuncio de subida de rango al canal de logros.
     * @param {import('discord.js').Guild} guild El servidor de Discord.
     * @param {import('discord.js').GuildMember} member El miembro que subió de rango.
     * @param {object} data Los datos de la notificación.
     */
    async sendRankUpAnnouncement(guild, member, data) {
        const announcementsChannel = guild.channels.cache.find(
            c => c.name === 'logros' || c.name === 'announcements' || c.name === 'anuncios'
        );

        if (!announcementsChannel) return;

        if (data.new_rank_level >= 4) { // Solo anunciar para rangos altos
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
                .setThumbnail(`https://crafatar.com/avatars/${notification.minecraft_uuid}?overlay`)
                .setFooter({ text: 'Sigue así y alcanza la cima!' })
                .setTimestamp();

            await announcementsChannel.send({ embeds: [embed] });
        }
    }
}

/**
 * Devuelve un color hexadecimal basado en el nombre del rango.
 * @param {string} rankName El nombre del rango.
 * @returns {number} El color en formato hexadecimal.
 */
function getRankColor(rankName) {
    switch (rankName) {
        case 'Bridge Deidad': return 0xff0000; // Red
        case 'Bridge Maestro': return 0xffd700; // Gold
        case 'Bridge Experto': return 0x00ff00; // Green
        case 'Bridge Avanzado': return 0x00bfff; // Deep Sky Blue
        case 'Bridge Competidor': return 0x9370db; // Medium Purple
        case 'Bridge Aprendiz': return 0xc0c0c0; // Silver
        default: return 0x808080; // Gray
    }
}

module.exports = NotificationHandler;
